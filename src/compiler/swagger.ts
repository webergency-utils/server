import ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { buildJsonSchema } from '@webergency-utils/typechecker/transformer';
import { ProjectRegistry } from './transformer.js';

export class SwaggerSpecGenerator 
{
    public static generate( registry: ProjectRegistry, program: ts.Program, outputDir: string ) 
    {
        const checker = program.getTypeChecker();
    
        const spec: any = {
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

        const registerSchema = ( schema: any ) => 
        {
            if( !schema ) { return schema }
      
            if( schema.$defs ) 
            {
                for( const [key, val] of Object.entries( schema.$defs )) 
                {
                    defs[key] = val;
                }
                delete schema.$defs;
            }
      
            let json = JSON.stringify( schema );
            json = json.replace( /#\/\$defs\//g, '#/components/schemas/' );

            return JSON.parse( json );
        };

        for( const ep of registry.endpoints ) 
        {
            // WS and SSE custom event connections are not mapped to standard HTTP verbs in Swagger
            if( ep.httpMethod === 'WS' ) { continue }

            const controllerInfo = registry.controllers.get( ep.controller );

            if( !controllerInfo ) { continue }

            const sourceFile = program.getSourceFile( controllerInfo.path );

            if( !sourceFile ) { continue }

            let methodDecl: ts.MethodDeclaration | undefined;

            const findMethod = ( node: ts.Node ) => 
            {
                if( ts.isClassDeclaration( node ) && node.name?.text === ep.controller ) 
                {
                    for( const member of node.members ) 
                    {
                        if( ts.isMethodDeclaration( member ) && member.name.getText() === ep.methodName ) 
                        {
                            methodDecl = member;
                            break;
                        }
                    }
                }

                if( !methodDecl ) { ts.forEachChild( node, findMethod ) }
            };

            findMethod( sourceFile );

            if( !methodDecl ) { continue }

            const swaggerPath = ep.path.replace( /:([a-zA-Z0-9_]+)/g, '{$1}' );

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
                else if( paramMeta.source === 'Query' ) 
                {
                    const schema = registerSchema( buildJsonSchema( type, checker ));

                    if( paramMeta.name ) 
                    {
                        queryParams.push({
                            name     : paramMeta.name,
                            in       : 'query',
                            required : !paramDecl.questionToken,
                            schema
                        });
                    }
                    else if( schema && schema.properties ) 
                    {
                        for( const [k, v] of Object.entries( schema.properties )) 
                        {
                            queryParams.push({
                                name     : k,
                                in       : 'query',
                                required : ( schema.required || []).includes( k ),
                                schema   : v
                            });
                        }
                    }
                }
                else if( paramMeta.source === 'Body' ) 
                {
                    const schema = registerSchema( buildJsonSchema( type, checker ));
                    requestBody = {
            required : true,
            content  : {
                'application/json' : {
                    schema
                }
            }
          };
                }
            }

            const signature = checker.getSignatureFromDeclaration( methodDecl );
            let responseSchema: any = { type : 'string' };

            if( signature ) 
            {
                let returnType = checker.getReturnTypeOfSignature( signature );
        
                if( returnType.symbol?.name === 'Promise' ) 
                {
                    const typeArgs = ( returnType as ts.TypeReference ).typeArguments;

                    if( typeArgs && typeArgs[0]) 
                    {
                        returnType = typeArgs[0];
                    }
                }
        
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
                    catch ( e ) {}
                }
            }

            const operation: any = {
        summary   : `${ep.controller}.${ep.methodName}`,
        responses : {
            '200' : {
                description : 'Successful Response',
                content     : {
                    'application/json' : {
                        schema : responseSchema
                    }
                }
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
                ? ['get', 'post', 'put', 'delete', 'patch']
                : [swaggerMethod];

            for( const m of swaggerMethods ) 
            {
                spec.paths[swaggerPath][m] = {
          ...operation,
          summary : swaggerMethod === 'all' ? `${operation.summary} (${m.toUpperCase()})` : operation.summary
        };
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
