import ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { buildJsonSchema } from '@webergency-utils/typechecker/transformer';
import { ProjectRegistry } from './registry.js';
import { unwrapReturnType } from './endpoint-analyzer.js';
import { getBaseClass } from './di-resolution.js';

function isOpenApiIdentChar( code: number ): boolean
{
    return ( code >= 48 && code <= 57 )
        || ( code >= 65 && code <= 90 )
        || ( code >= 97 && code <= 122 )
        || code === 95;
}

export function toOpenApiPath( rawPath: string ): string
{
    const len = rawPath.length;
    const parts: string[] = [];
    let cursor = 0;
    let cachedCloseParen = -1;
    let i = 0;

    while( i < len )
    {
        const ch = rawPath.charCodeAt( i );

        if( ch === 58 )
        {
            let nameEnd = i + 1;

            while( nameEnd < len && isOpenApiIdentChar( rawPath.charCodeAt( nameEnd )))
            {
                nameEnd++;
            }

            if( nameEnd > i + 1 )
            {
                if( i > cursor ){ parts.push( rawPath.slice( cursor, i )) }

                const name = rawPath.slice( i + 1, nameEnd );
                let next = nameEnd;

                if( next < len && rawPath.charCodeAt( next ) === 40 )
                {
                    if( cachedCloseParen <= next && cachedCloseParen !== len )
                    {
                        const found = rawPath.indexOf( ')', next + 1 );
                        cachedCloseParen = found === -1 ? len : found;
                    }

                    if( cachedCloseParen < len )
                    {
                        next = cachedCloseParen + 1;
                    }
                }

                if( next < len )
                {
                    const mod = rawPath.charCodeAt( next );

                    if( mod === 63 || mod === 42 || mod === 43 )
                    {
                        next++;
                    }
                }

                parts.push( `{${name}}` );
                cursor = next;
                i = next;
                continue;
            }
        }
        else if( ch === 42 )
        {
            if( i > cursor ){ parts.push( rawPath.slice( cursor, i )) }

            let nameEnd = i + 1;

            while( nameEnd < len && isOpenApiIdentChar( rawPath.charCodeAt( nameEnd )))
            {
                nameEnd++;
            }

            if( nameEnd > i + 1 )
            {
                parts.push( `{${rawPath.slice( i + 1, nameEnd )}}` );
                cursor = nameEnd;
                i = nameEnd;
                continue;
            }

            parts.push( '{wildcard}' );
            cursor = i + 1;
            i++;
            continue;
        }

        i++;
    }

    if( cursor === 0 )
    {
        return rawPath;
    }

    if( cursor < len )
    {
        parts.push( rawPath.slice( cursor ));
    }

    return parts.join( '' );
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

        const pathsMap = new Map<string, Map<string, any>>();
        const defs = new Map<string, any>();

        const rewriteDefRefs = ( value: any ): any =>
        {
            const json = JSON.stringify( value ).replaceAll( '#/$defs/', '#/components/schemas/' );

            return JSON.parse( json );
        };

        const registerSchema = ( schema: any ) => 
        {
            if( !schema ) { return schema }
      
            if( schema.$defs ) 
            {
                for( const [ key, val ] of Object.entries( schema.$defs )) 
                {
                    defs.set( key, rewriteDefRefs( val ));
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

                if( defs.has( key ))
                {
                    return defs.get( key );
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
            let pathItem = pathsMap.get( swaggerPath );

            if( !pathItem )
            {
                pathItem = new Map<string, any>();
                pathsMap.set( swaggerPath, pathItem );
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

                pathItem.set( m, cloned );
            }
        }

        spec.paths = Object.fromEntries(
            Array.from( pathsMap, ([ pathKey, methods ]) => [ pathKey, Object.fromEntries( methods )])
        );

        if( defs.size > 0 ) 
        {
            spec.components.schemas = Object.fromEntries( defs );
        }

        const swaggerJsonPath = path.resolve( outputDir, 'swagger.json' );
        fs.writeFileSync( swaggerJsonPath, JSON.stringify( spec, null, 2 ));
        console.log( `✅ Swagger docs generated: ${swaggerJsonPath}` );
    }
}
