import ts from 'typescript';
import { buildValidator, buildSerializer, generateHash } from '@webergency-utils/typechecker/transformer';
import type { ValidationMode } from '@webergency-utils/typechecker';

import { ProjectRegistry } from './registry.js';
import {
    HTTP_METHOD_DECORATORS,
    extractCorsConfig,
    extractSecurityConfig,
    extractFileConfig,
    extractResponseMode,
    hasPublicDecorator,
    hasSeoDecorator,
    hasInternalDecorator,
    parseExpression
} from './decorator-config.js';
import { mergeFileConfigs } from '../helpers/file-upload.js';
import { unwrapSsePayloadType } from './sse-types.js';
import { findConstructorDeps, resolvePropertyDeps } from './di-resolution.js';
import { MetadataCollector, applyDirectives, byName, guardName } from './metadata-collector.js';
import { DiagnosticReporter, DiagnosticCode } from './diagnostics.js';

/** Merge a hierarchy of `@Cors` / `@Security` configs; a non-object entry replaces the merge. */
function mergeConfigs( configs: any[]): any
{
    if( configs.length === 0 ) { return undefined }

    let merged: any = {};

    for( const config of configs )
    {
        merged = typeof config === 'object' ? { ...merged, ...config } : config;
    }

    return merged;
}

/** The declared return type with `Promise<...>` peeled off. */
function unwrapReturnType( member: ts.MethodDeclaration, checker: ts.TypeChecker ): { type : ts.Type, isPromise : boolean } | undefined
{
    const signature = checker.getSignatureFromDeclaration( member );

    if( !signature ) { return undefined }

    let type = checker.getReturnTypeOfSignature( signature );
    let isPromise = false;

    if( type.symbol?.name === 'Promise' )
    {
        isPromise = true;
        const typeArgs = ( type as ts.TypeReference ).typeArguments;

        if( typeArgs && typeArgs[0])
        {
            type = typeArgs[0];
        }
    }

    return { type, isPromise };
}

function isVoidType( type: ts.Type, checker: ts.TypeChecker ): boolean
{
    const asString = checker.typeToString( type );

    return asString === 'void' || asString === 'undefined' || ( type.flags & ts.TypeFlags.Void ) !== 0 || ( type.flags & ts.TypeFlags.Undefined ) !== 0;
}

/** True when a type is (structurally or by name) a valid `@Seo` return: void | SeoForward | unions thereof. */
function isSeoCompatibleReturnType( type: ts.Type, checker: ts.TypeChecker ): boolean
{
    if( isVoidType( type, checker )){ return true }

    if( type.isUnion())
    {
        return type.types.every( t => isSeoCompatibleReturnType( t, checker ));
    }

    const name = type.aliasSymbol?.escapedName?.toString() || type.symbol?.name;

    if( name === 'SeoForward' ){ return true }

    const method = checker.getPropertyOfType( type, 'method' );
    const pathProp = checker.getPropertyOfType( type, 'path' );

    if( !method || !pathProp ){ return false }

    const methodDecl = method.valueDeclaration || method.declarations?.[0];
    const pathDecl = pathProp.valueDeclaration || pathProp.declarations?.[0];

    if( !methodDecl || !pathDecl ){ return false }

    const methodType = checker.getTypeOfSymbolAtLocation( method, methodDecl );
    const pathType = checker.getTypeOfSymbolAtLocation( pathProp, pathDecl );
    const methodStr = checker.typeToString( methodType );
    const pathStr = checker.typeToString( pathType );

    return (( methodType.flags & ts.TypeFlags.StringLike ) !== 0 || methodStr === 'string' )
        && (( pathType.flags & ts.TypeFlags.StringLike ) !== 0 || pathStr === 'string' );
}

/** How an HTTP method decorator maps onto the runtime endpoint shape. */
const METHOD_KINDS: Record<string, { httpMethod : string, meta : 'sse' | 'ws' | 'rpc' | 'event' | undefined }> = {
    Sse            : { httpMethod : 'GET', meta : 'sse' },
    Ws             : { httpMethod : 'WS', meta : 'ws' },
    MessagePattern : { httpMethod : 'RPC', meta : 'rpc' },
    EventPattern   : { httpMethod : 'RPC', meta : 'event' }
};

/**
 * Analysis pass: fills the registry with endpoints and validators for one source file, and
 * writes the static `__injections__` table onto every DI-relevant class.
 */
export function transformer( program: ts.Program, registry: ProjectRegistry, reporter?: DiagnosticReporter ) 
{
    const checker = program.getTypeChecker();
    const diagnostics = reporter ?? new DiagnosticReporter();
    // Nobody else holds this reporter, so problems have to be raised here to be seen.
    const ownsDiagnostics = reporter === undefined;

    return ( context: ts.TransformationContext ) => 
    {
        return ( sourceFile: ts.SourceFile ) => 
        {
            const collector = new MetadataCollector( checker, registry, diagnostics );

            // Check for invalid decorator usages
            const checkDecorators = ( node: ts.Node ) => 
            {
                if( ts.canHaveDecorators( node ))
                {
                    const decorators = ts.getDecorators( node );

                    if( decorators ) 
                    {
                        for( const dec of decorators ) 
                        {
                            const expr = dec.expression;

                            if( ts.isCallExpression( expr ) && ts.isIdentifier( expr.expression ) && expr.expression.text === 'Inject' && expr.arguments.length === 0 ) 
                            {
                                diagnostics.error(
                                    expr,
                                    DiagnosticCode.DECORATOR_MISUSE,
                                    'Decorator "@Inject" must not be called with empty parentheses. Use "@Inject" instead of "@Inject()".'
                                );
                            }
                        }
                    }
                }
                ts.forEachChild( node, checkDecorators );
            };
            checkDecorators( sourceFile );

            for( const statement of sourceFile.statements ) 
            {
                if( ts.isClassDeclaration( statement )) 
                {
                    const decorators = ts.getDecorators( statement );
                    let controllerDec: ts.Decorator | null = null;

                    if( decorators ) { for( const d of decorators ) { if( ts.isCallExpression( d.expression ) && ts.isIdentifier( d.expression.expression ) && d.expression.expression.text === 'Controller' ) { controllerDec = d; break } } }

                    let injectableDec: ts.Decorator | null = null;

                    if( decorators ) 
                    {
                        for( const d of decorators ) 
                        {
                            const ident = ts.isCallExpression( d.expression ) ? d.expression.expression : d.expression;

                            if( ts.isIdentifier( ident ) && ident.text === 'Injectable' ) 
                            {
                                injectableDec = d;
                                break;
                            }
                        }
                    }

                    if( injectableDec && statement.name ) 
                    {
                        const providerName = statement.name.text;

                        if( !registry.providers.has( providerName )) 
                        {
                            registry.providers.set( providerName, { path : sourceFile.fileName });
                        }
                    }

                    if( controllerDec ) 
                    {
                        const controllerName = statement.name?.text || 'Anonymous';

                        if( !registry.controllers.has( controllerName )) { registry.controllers.set( controllerName, { path : sourceFile.fileName, injections : new Map() }) }

                        const prefix = ( controllerDec.expression as ts.CallExpression ).arguments[0] as ts.StringLiteral;
                        const classPublic = hasPublicDecorator( decorators );
                        const classSeo = hasSeoDecorator( decorators );
                        const classInternal = hasInternalDecorator( decorators );
                        const classMeta = collector.collectClassMetadata( statement );

                        // Nearest declaration wins for each of these, parent first.
                        const classResponseMode = classMeta.responseModes.length > 0
                            ? classMeta.responseModes[classMeta.responseModes.length - 1]
                            : undefined;
                        const classCors = mergeConfigs( classMeta.corsConfigs );
                        const classSecurity = mergeConfigs( classMeta.securityConfigs );
                        const classFiles = mergeFileConfigs( classMeta.fileConfigs );

                        // Scan for property injections AFTER decorators have registered their classes
                        collector.scanInjections( statement, controllerName );

                        const type = checker.getTypeAtLocation( statement );

                        for( const symbol of type.getProperties()) 
                        {
                            const member = symbol.valueDeclaration || symbol.declarations?.[0];

                            if( member && ts.isMethodDeclaration( member )) 
                            {
                                const mDecs = ts.getDecorators( member );
                                let httpDec: ts.Decorator | null = null;

                                if( mDecs ) { for( const d of mDecs ) { if( ts.isCallExpression( d.expression ) && HTTP_METHOD_DECORATORS.includes( d.expression.expression.getText())) { httpDec = d; break } } }

                                if( httpDec ) 
                                {
                                    const method = ( httpDec.expression as ts.CallExpression ).expression.getText();
                                    const pathArg = ( httpDec.expression as ts.CallExpression ).arguments[0] as ts.StringLiteral;
                                    const fullPath = ( prefix?.text || '' ) + ( pathArg?.text || '' );

                                    const methodPublic = hasPublicDecorator( mDecs );
                                    const methodSeo = hasSeoDecorator( mDecs );
                                    const methodInternal = hasInternalDecorator( mDecs );
                                    const isSeo = methodSeo || classSeo;
                                    const isInternal = methodInternal || classInternal;

                                    if( isSeo && isInternal )
                                    {
                                        diagnostics.error(
                                            member,
                                            DiagnosticCode.DECORATOR_MISUSE,
                                            `Method "${member.name.getText()}" cannot be both @Seo and @Internal`
                                        );
                                    }

                                    const methodCors = extractCorsConfig( mDecs, sourceFile );
                                    const activeCors = methodCors !== undefined ? methodCors : classCors;

                                    const methodSecurity = extractSecurityConfig( mDecs, sourceFile );
                                    const activeSecurity = methodSecurity !== undefined ? methodSecurity : classSecurity;

                                    const methodFiles = extractFileConfig( mDecs, sourceFile );
                                    const activeFiles = mergeFileConfigs([ classFiles, methodFiles ]);

                                    const methodResponseMode = extractResponseMode( mDecs );
                                    const activeResponseMode = methodResponseMode !== undefined ? methodResponseMode : classResponseMode;

                                    // Same merge rules as class-over-base, one level down.
                                    const activeGuards = ( methodPublic || classPublic )
                                        ? []
                                        : applyDirectives( classMeta.guards, collector.guardDirectives( mDecs ), guardName );
                                    const activeInterceptors = applyDirectives( classMeta.interceptors, collector.interceptorDirectives( mDecs ), byName );
                                    const activeMiddlewares = applyDirectives( classMeta.middlewares, collector.middlewareDirectives( mDecs ), byName );
                                    const paramsMetadata = collector.resolveParamsMetadata( member.parameters, method === 'Ws' );

                                    if( method === 'Head' ) 
                                    {
                                        const returned = unwrapReturnType( member, checker );

                                        if( returned && !isVoidType( returned.type, checker )) 
                                        {
                                            const returnTypeStr = checker.typeToString( returned.type );
                                            diagnostics.error(
                                                member,
                                                DiagnosticCode.INVALID_SIGNATURE,
                                                `Method "${member.name.getText()}" decorated with @Head must return void or Promise<void>. Found: ${returned.isPromise ? 'Promise<' + returnTypeStr + '>' : returnTypeStr}`
                                            );
                                        }
                                    }

                                    const kind = METHOD_KINDS[method];
                                    const httpMethod = kind ? kind.httpMethod : method.toUpperCase();
                                    const isSse = kind?.meta === 'sse';
                                    const isWs = kind?.meta === 'ws';
                                    const isRpc = kind?.meta === 'rpc' || kind?.meta === 'event';
                                    const isEvent = kind?.meta === 'event';
                                    let wsOptions: any = undefined;

                                    if( isWs && ts.isCallExpression( httpDec.expression ) && httpDec.expression.arguments.length > 1 ) 
                                    {
                                        wsOptions = parseExpression( httpDec.expression.arguments[1], sourceFile );
                                    }

                                    let returnTypeValidatorHash = '';
                                    let returnTypeSerializerHash = '';
                                    const returned = unwrapReturnType( member, checker );

                                    if( returned ) 
                                    {
                                        const returnType = returned.type;
                                        const returnTypeStr = checker.typeToString( returnType );
                                        const isVoid = isVoidType( returnType, checker );
                                        const isResponse = returnTypeStr === 'Response' || returnType.symbol?.name === 'Response';
                                        const isNever = returnTypeStr === 'never';

                                        if( isSeo )
                                        {
                                            if( !isSeoCompatibleReturnType( returnType, checker ))
                                            {
                                                diagnostics.error(
                                                    member,
                                                    DiagnosticCode.INVALID_SIGNATURE,
                                                    `Method "${member.name.getText()}" decorated with @Seo must return SeoForward | void`
                                                    + `${returned.isPromise ? ' (or Promise of that)' : ''}. Found: `
                                                    + `${returned.isPromise ? 'Promise<' + returnTypeStr + '>' : returnTypeStr}`
                                                );
                                            }
                                        }
                                        else if( !isVoid && !isResponse && !isNever && !isWs )
                                        {
                                            let typeForValidator: ts.Type | undefined = returnType;

                                            if( isSse )
                                            {
                                                typeForValidator = unwrapSsePayloadType( returnType, checker );
                                            }

                                            if( typeForValidator )
                                            {
                                                const mode = ( activeResponseMode || 'strip' ) as ValidationMode;
                                                const typeHash = generateHash( typeForValidator, checker );

                                                if( !registry.validators.has( typeHash ))
                                                {
                                                    buildValidator( typeForValidator, checker, registry.validators );
                                                }
                                                returnTypeValidatorHash = typeHash;

                                                const serKey = `${typeHash}_${mode}_json`;

                                                if( !registry.serializers.has( serKey ))
                                                {
                                                    buildSerializer( typeForValidator, checker, registry.serializers, typeHash, { mode, format : 'json' });
                                                }
                                                returnTypeSerializerHash = serKey;
                                            }
                                        }
                                    }

                                    const endpoint: any = {
                                        controller   : controllerName,
                                        methodName   : member.name.getText(),
                                        httpMethod,
                                        path         : fullPath,
                                        params       : paramsMetadata,
                                        guards       : activeGuards,
                                        interceptors : activeInterceptors,
                                        middlewares  : activeMiddlewares,
                                        meta         : {}
                                    };

                                    if( activeResponseMode !== undefined ) 
                                    {
                                        endpoint.returnTypeMode = activeResponseMode;
                                    }

                                    if( returnTypeValidatorHash ) 
                                    {
                                        endpoint.returnTypeValidator = returnTypeValidatorHash;
                                    }

                                    if( returnTypeSerializerHash ) 
                                    {
                                        endpoint.returnTypeSerializer = returnTypeSerializerHash;
                                    }


                                    if( isSse ) 
                                    {
                                        endpoint.meta.sse = true;
                                    }

                                    if( isWs ) 
                                    {
                                        endpoint.meta.ws = true;

                                        if( wsOptions !== undefined ) 
                                        {
                                            endpoint.meta.wsOptions = wsOptions;
                                        }
                                    }

                                    if( isRpc ) 
                                    {
                                        endpoint.meta.rpc = true;

                                        if( isEvent ) 
                                        {
                                            endpoint.meta.event = true;
                                        }
                                    }

                                    if( activeCors !== undefined ) 
                                    {
                                        endpoint.cors = activeCors;
                                    }

                                    if( activeSecurity !== undefined ) 
                                    {
                                        endpoint.security = activeSecurity;
                                    }

                                    if( activeFiles !== undefined )
                                    {
                                        endpoint.files = activeFiles;
                                    }

                                    if( isSeo )
                                    {
                                        endpoint.seo = true;
                                    }

                                    if( isInternal )
                                    {
                                        endpoint.internal = true;
                                    }

                                    registry.endpoints.push( endpoint );
                                }
                            }
                        }
                    }

                    const possibleGuardName = statement.name?.text;

                    if( possibleGuardName && registry.guards.has( possibleGuardName )) 
                    {
                        const guardInfo = registry.guards.get( possibleGuardName )!;
                        const useMethod = statement.members.find( m => ts.isMethodDeclaration( m ) && m.name.getText() === 'use' ) as ts.MethodDeclaration;

                        if( useMethod ) 
                        {
                            guardInfo.params = collector.resolveParamsMetadata( useMethod.parameters );
                        }
                    }
                }
            }

            if( ownsDiagnostics ) { diagnostics.throwIfErrors() }

            if( context && typeof context.factory !== 'undefined' ) 
            {
                const visit = ( node: ts.Node ): ts.Node => 
                {
                    if( ts.isClassDeclaration( node )) 
                    {
                        const className = node.name?.text || 'Anonymous';
                        const isController = registry.controllers.has( className );
                        const isProvider = registry.providers.has( className );
                        const isModule = registry.modules.has( className );
                        const isGuard = registry.guards.has( className );
                        const isInterceptor = registry.interceptors.has( className );

                        const decorators = ts.getDecorators( node );
                        let hasInjectableDec = false;
                        let hasControllerDec = false;
                        let hasModuleDec = false;

                        if( decorators ) 
                        {
                            for( const d of decorators ) 
                            {
                                const text = d.expression.getText();

                                if( text.includes( 'Injectable' )) { hasInjectableDec = true }

                                if( text.includes( 'Controller' )) { hasControllerDec = true }

                                if( text.includes( 'Module' )) { hasModuleDec = true }
                            }
                        }

                        if( isController || isProvider || isModule || isGuard || isInterceptor || hasInjectableDec || hasControllerDec || hasModuleDec ) 
                        {
                            const constructorDeps = findConstructorDeps( node, checker ) || [];
                            const propertyDeps = resolvePropertyDeps( node, checker ) || {};

                            const injectionsObj = ts.factory.createObjectLiteralExpression([
                                ts.factory.createPropertyAssignment(
                                    'constructorDeps',
                                    ts.factory.createArrayLiteralExpression(
                                        constructorDeps.map( dep => ts.factory.createStringLiteral( dep ))
                                    )
                                ),
                                ts.factory.createPropertyAssignment(
                                    'propertyDeps',
                                    ts.factory.createObjectLiteralExpression(
                                        Object.entries( propertyDeps ).map(([propName, depToken]) =>
                                            ts.factory.createPropertyAssignment(
                                                ts.factory.createIdentifier( propName ),
                                                ts.factory.createStringLiteral( depToken )
                                            )
                                        ),
                                        true
                                    )
                                )
                            ], true );

                            const injectionsProperty = ts.factory.createPropertyDeclaration(
                                [
                                    ts.factory.createModifier( ts.SyntaxKind.StaticKeyword )
                                ],
                                ts.factory.createIdentifier( '__injections__' ),
                                undefined,
                                undefined,
                                injectionsObj
                            );

                            return ts.factory.updateClassDeclaration(
                                node,
                                node.modifiers,
                                node.name,
                                node.typeParameters,
                                node.heritageClauses,
                                ts.factory.createNodeArray([injectionsProperty, ...node.members])
                            );
                        }
                    }

                    return ts.visitEachChild( node, visit, context );
                };

                return ts.visitNode( sourceFile, visit ) as ts.SourceFile;
            }

            return sourceFile;
        };
    };
}
