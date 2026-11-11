import ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { buildJsonSchema } from '@webergency-utils/typechecker/transformer';
import { ProjectRegistry } from './registry.js';
import { unwrapReturnType } from './endpoint-analyzer.js';
import { getBaseClass } from './di-resolution.js';

function toOpenApiPath( rawPath: string ): string
{
    return rawPath
        .replace( /:([a-zA-Z0-9_]+)(?:\([^)]*\))?[?*+]?/g, '{$1}' )
        .replace( /\*([a-zA-Z0-9_]+)/g, '{$1}' )
        .replace( /\*/g, '{wildcard}' );
}

function findControllerMethod(
    classDecl : ts.ClassDeclaration,
    methodName : string,
    checker   : ts.TypeChecker
): ts.MethodDeclaration | undefined
{
    let current: ts.ClassDeclaration | null = classDecl;

    while( current )
    {
        const sf = current.getSourceFile();

        for( const member of current.members )
        {
            if( ts.isMethodDeclaration( member ) && member.name.getText( sf ) === methodName )
            {
                return member;
            }
        }

        current = getBaseClass( current, checker );
    }

    return undefined;
}

export class SwaggerSpecGenerator 
{
    public static generate( registry: ProjectRegistry, program: ts.Program, outputDir: string ) 
    {
        const checker = program.getTypeChecker();
    
        const spec: any =
        {
            openapi : '3.0.0',
            info    : {
                title       : 'Webergency Application API',
                version     : '1.0.0',
                description : 'Automatically generated AOT REST & RPC endpoint documentation.'
            },
            paths      : {},
            components : {
                schemas : {}
            }
        };

        const defs: Record<string, any> = {};

        const rewriteDefRefs = ( value: any ): any =>
        {
            let json = JSON.stringify( value );
            json = json.replace( /#\/\$defs\//g, '#/components/schemas/' );

            return JSON.parse( json );
        };

        const registerSchema = ( schema: any ) => 
        {
            if( !schema ) { return schema }
      
            if( schema.$defs ) 
            {
                for( const [key, val] of Object.entries( schema.$defs )) 
                {
                    defs[key] = rewriteDefRefs( val );
                }
                delete schema.$defs;
            }
      
            return rewriteDefRefs( schema );
        };

        const derefSchema = ( schema: any ): any =>
        {
            if( schema && typeof schema.$ref === 'string' && schema.$ref.startsWith( '#/components/schemas/' ))
            {
                const key = schema.$ref.slice( '#/components/schemas/'.length );

                if( Object.hasOwn( defs, key ))
                {
                    return defs[key];
                }
            }

            return schema;
        };

        for( const ep of registry.endpoints ) 
        {
            // WS and internal-only routes are not part of the public HTTP OpenAPI spec
            if( ep.httpMethod === 'WS' || ep.internal || ep.meta?.internal ) { continue }

            const controllerInfo = registry.controllers.get( ep.controller );

            if( !controllerInfo ) { continue }

            const sourceFile = program.getSourceFile( controllerInfo.path );

            if( !sourceFile ) { continue }

            let methodDecl: ts.MethodDeclaration | undefined;

            const findMethod = ( node: ts.Node ) => 
            {
                if( ts.isClassDeclaration( node ) && node.name?.text === ep.controller ) 
                {
                    methodDecl = findControllerMethod( node, ep.methodName, checker );
                }

                if( !methodDecl ) { ts.forEachChild( node, findMethod ) }
            };

            findMethod( sourceFile );

            if( !methodDecl ) { continue }

            const declSourceFile = methodDecl.getSourceFile();
            const swaggerPath = toOpenApiPath( ep.path );

            if( !spec.paths[swaggerPath]) 
            {
                spec.paths[swaggerPath] = {};
            }

            const swaggerMethod = ep.httpMethod.toLowerCase();
            const pathParams: any[] = [];
            let requestBody: any = undefined;
            const queryParams: any[] = [];

            for( let i = 0; i < methodDecl.parameters.length; i++ ) 
            {
                const paramDecl = methodDecl.parameters[i];
                const paramMeta = ep.params[i];

                if( !paramMeta ) { continue }

                const type = checker.getTypeAtLocation( paramDecl );

                if( paramMeta.source === 'Param' ) 
                {
                    const schema = registerSchema( buildJsonSchema( type, checker ));
                    pathParams.push({
                        name     : paramMeta.name,
                        in       : 'path',
                        required : true,
                        schema
                    });
                }
                else if( paramMeta.source === 'Query' || paramMeta.source === 'Header' || paramMeta.source === 'Headers' || paramMeta.source === 'Cookie' || paramMeta.source === 'Cookies' ) 
                {
                    const inLocation = ( paramMeta.source === 'Header' || paramMeta.source === 'Headers' )
                        ? 'header'
                        : ( paramMeta.source === 'Cookie' || paramMeta.source === 'Cookies' )
                            ? 'cookie'
                            : 'query';
                    const schema = registerSchema( buildJsonSchema( type, checker ));

                    if( paramMeta.name ) 
                    {
                        queryParams.push({
                            name     : paramMeta.name,
                            in       : inLocation,
                            required : !paramDecl.questionToken && !paramMeta.optional,
                            schema
                        });
                    }
                    else
                    {
                        const resolvedSchema = derefSchema( schema );

                        if( resolvedSchema && resolvedSchema.properties ) 
                        {
                            for( const [k, v] of Object.entries( resolvedSchema.properties )) 
                            {
                                queryParams.push({
                                    name     : k,
                                    in       : inLocation,
                                    required : ( resolvedSchema.required || []).includes( k ),
                                    schema   : v
                                });
                            }
                        }
                    }
                }
                else if( paramMeta.source === 'Body' ) 
                {
                    const typeText = paramDecl.type ? paramDecl.type.getText( declSourceFile ) : '';
                    const isMultipartBag = /\b(MultipartPayload|UploadedFile)\b/.test( typeText )
                        || !!( ep.files && typeof ep.files === 'object' );

                    if( isMultipartBag )
                    {
                        const properties = requestBody?.content?.['multipart/form-data']?.schema?.properties
                            ? { ...requestBody.content['multipart/form-data'].schema.properties }
                            : {};

                        requestBody = {
                            required : true,
                            content  : {
                                'multipart/form-data' : {
                                    schema : {
                                        type       : 'object',
                                        properties : Object.keys( properties ).length
                                            ? properties
                                            : { file : { type : 'string', format : 'binary' } },
                                        additionalProperties : true
                                    }
                                }
                            }
                        };
                    }
                    else if( paramMeta.name )
                    {
                        const schema = registerSchema( buildJsonSchema( type, checker ));
                        const existingProps = requestBody?.content?.['application/json']?.schema?.properties || {};
                        const existingReq: string[] = requestBody?.content?.['application/json']?.schema?.required || [];
                        const properties = { ...existingProps, [paramMeta.name] : schema };
                        const requiredList = !paramDecl.questionToken && !paramMeta.optional && !existingReq.includes( paramMeta.name )
                            ? [ ...existingReq, paramMeta.name ]
                            : existingReq;

                        requestBody = {
                            required : true,
                            content  : {
                                'application/json' : {
                                    schema : {
                                        type : 'object',
                                        properties,
                                        ...( requiredList.length > 0 ? { required : requiredList } : {})
                                    }
                                }
                            }
                        };
                    }
                    else
                    {
                        const schema = registerSchema( buildJsonSchema( type, checker ));
                        requestBody = {
                            required : !paramMeta.optional,
                            content  : {
                                'application/json' : {
                                    schema
                                }
                            }
                        };
                    }
                }
                else if( paramMeta.source === 'RawBody' || ( paramMeta.source === 'BodyHash' && !requestBody ))
                {
                    requestBody = {
                        required : !paramMeta.optional,
                        content  : {
                            'application/octet-stream' : {
                                schema : { type : 'string', format : 'binary' }
                            }
                        }
                    };
                }
                else if( paramMeta.source === 'File' && paramMeta.name )
                {
                    const properties = requestBody?.content?.['multipart/form-data']?.schema?.properties
                        ? { ...requestBody.content['multipart/form-data'].schema.properties }
                        : {};
                    properties[paramMeta.name] = { type : 'string', format : 'binary' };
                    requestBody = {
                        required : true,
                        content  : {
                            'multipart/form-data' : {
                                schema : {
                                    type : 'object',
                                    properties
                                }
                            }
                        }
                    };
                }
                else if( paramMeta.source === 'Files' )
                {
                    const properties = requestBody?.content?.['multipart/form-data']?.schema?.properties
                        ? { ...requestBody.content['multipart/form-data'].schema.properties }
                        : {};

                    if( paramMeta.name )
                    {
                        properties[paramMeta.name] = {
                            type  : 'array',
                            items : { type : 'string', format : 'binary' }
                        };
                    }

                    requestBody = {
                        required : true,
                        content  : {
                            'multipart/form-data' : {
                                schema : {
                                    type       : 'object',
                                    properties : Object.keys( properties ).length
                                        ? properties
                                        : { file : { type : 'string', format : 'binary' } }
                                }
                            }
                        }
                    };
                }
            }

            // OpenAPI 3.0 requires every `{param}` placeholder in the path template to be declared in `parameters`.
            const declaredPathNames = new Set( pathParams.map( p => p.name ));

            for( const match of swaggerPath.matchAll( /\{([^}]+)\}/g ))
            {
                const placeholder = match[1];

                if( !declaredPathNames.has( placeholder ))
                {
                    declaredPathNames.add( placeholder );
                    pathParams.push({
                        name     : placeholder,
                        in       : 'path',
                        required : true,
                        schema   : { type : 'string' }
                    });
                }
            }

            // Hierarchical `@File({ fields })` without param decorators still documents multipart.
            if( ep.files && typeof ep.files === 'object' )
            {
                const fieldNames = ep.files.fields && typeof ep.files.fields === 'object'
                    ? Object.keys( ep.files.fields )
                    : [];
                const existing = requestBody?.content?.['multipart/form-data']?.schema?.properties || {};
                const properties = { ...existing };

                for( const name of fieldNames )
                {
                    if( !properties[name])
                    {
                        properties[name] = { type : 'string', format : 'binary' };
                    }
                }

                if( Object.keys( properties ).length > 0 || !requestBody )
                {
                    requestBody = {
                        required : true,
                        content  : {
                            'multipart/form-data' : {
                                schema : {
                                    type       : 'object',
                                    properties : Object.keys( properties ).length
                                        ? properties
                                        : { file : { type : 'string', format : 'binary' } }
                                }
                            }
                        }
                    };
                }
            }

            let responseSchema: any = { type : 'string' };
            const returned = unwrapReturnType( methodDecl, checker );

            if( returned ) 
            {
                const returnType = returned.type;

                if( ep.meta.sse ) 
                {
                    responseSchema = {
                        type        : 'string',
                        description : 'Server-Sent Events Stream'
                    };
                }
                else 
                {
                    try 
                    {
                        const rawSchema = buildJsonSchema( returnType, checker );
                        responseSchema = registerSchema( rawSchema );
                    }
                    catch( e ) 
                    {
                        // The response stays `{ type: 'string' }`, which is wrong often enough
                        // that it must not be silent.
                        console.warn( `⚠️ [swagger] Could not derive a response schema for ${ep.controller}.${ep.methodName} (${checker.typeToString( returnType )}): ${( e as Error ).message}` );
                    }
                }
            }

            const responseContent = ep.meta.sse
                ? {
                    'text/event-stream' : { schema : responseSchema },
                    'application/json'  : { schema : responseSchema }
                }
                : {
                    'application/json' : { schema : responseSchema }
                };

            const operation: any =
            {
                tags        : [ep.controller],
                summary     : `${ep.controller}.${ep.methodName}`,
                operationId : `${ep.controller}_${ep.methodName}`,
                responses   : {
                    '200' : {
                        description : 'Successful Response',
                        content     : responseContent
                    }
                }
            };

            const allParams = [...pathParams, ...queryParams];

            if( allParams.length > 0 ) 
            {
                operation.parameters = allParams;
            }

            if( requestBody ) 
            {
                operation.requestBody = requestBody;
            }

            const swaggerMethods = swaggerMethod === 'all'
                ? [ 'get', 'post', 'put', 'delete', 'patch', 'head', 'options' ]
                : [swaggerMethod];

            for( const m of swaggerMethods ) 
            {
                const cloned = structuredClone( operation );

                if( swaggerMethod === 'all' )
                {
                    cloned.summary = `${operation.summary} (${m.toUpperCase()})`;
                    cloned.operationId = `${ep.controller}_${ep.methodName}_${m}`;

                    if( m === 'get' || m === 'head' || m === 'options' )
                    {
                        delete cloned.requestBody;
                    }
                }

                spec.paths[swaggerPath][m] = cloned;
            }
        }

        if( Object.keys( defs ).length > 0 ) 
        {
            spec.components.schemas = defs;
        }

        const swaggerJsonPath = path.resolve( outputDir, 'swagger.json' );
        fs.writeFileSync( swaggerJsonPath, JSON.stringify( spec, null, 2 ));
        console.log( `✅ Swagger docs generated: ${swaggerJsonPath}` );
    }
}
