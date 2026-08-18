import ts from 'typescript';
import { buildParser, buildValidator, generateHash } from '@webergency-utils/typechecker/transformer';
import { ProjectRegistry } from './registry.js';
import { PARAM_DECORATORS, extractCorsConfig, extractSecurityConfig, extractResponseMode, extractFileConfig, extractReviver } from './decorator-config.js';
import { DiagnosticReporter, DiagnosticCode } from './diagnostics.js';
import { resolveTokenFromType } from './di-resolution.js';

/**
 * What a decorator list says about one merge dimension (guards, interceptors, middlewares):
 * what it adds, whether it discards everything inherited, and what it removes by name.
 */
export interface MergeDirectives<T> {
    direct     : T[]
    isOverride : boolean
    removeAll  : boolean
    toRemove   : Set<string>
}

interface MergeSpec<T> {
    /** `@Protect` — appends to whatever is inherited. */
    add       : string
    /** `@OverrideProtect` — replaces everything inherited. */
    override  : string
    /** `@Unprotect` — bare form removes all, called form removes the listed classes. */
    remove    : string
    collect   : ( call: ts.CallExpression, decorator: string ) => T[]
    removalOf : ( arg: ts.Expression, decorator: string ) => string | null
}

function readDirectives<T>( decorators: readonly ts.Decorator[] | undefined, spec: MergeSpec<T> ): MergeDirectives<T>
{
    const directives: MergeDirectives<T> = { direct : [], isOverride : false, removeAll : false, toRemove : new Set() };

    if( !decorators ) { return directives }

    for( const d of decorators )
    {
        if( ts.isCallExpression( d.expression ))
        {
            const name = d.expression.expression.getText();

            if( name === spec.add || name === spec.override )
            {
                if( name === spec.override ) { directives.isOverride = true }
                directives.direct.push( ...spec.collect( d.expression, name ));
            }
            else if( name === spec.remove )
            {
                for( const arg of d.expression.arguments )
                {
                    const resolved = spec.removalOf( arg, name );

                    if( resolved ) { directives.toRemove.add( resolved ) }
                }
            }
        }
        else if( ts.isIdentifier( d.expression ) && d.expression.text === spec.remove )
        {
            directives.removeAll = true;
        }
    }

    return directives;
}

/**
 * Fold one decorator level onto the level above it. Used for both class-over-base and
 * method-over-class, which is why removal is applied to the inherited list before the
 * override check discards it.
 */
export function applyDirectives<T>( inherited: readonly T[], directives: MergeDirectives<T>, nameOf: ( item: T ) => string ): T[]
{
    let kept: T[];

    if( directives.removeAll || directives.isOverride )
    {
        kept = [];
    }
    else if( directives.toRemove.size > 0 )
    {
        kept = inherited.filter( item => !directives.toRemove.has( nameOf( item )));
    }
    else
    {
        kept = [ ...inherited ];
    }

    return [ ...kept, ...directives.direct ];
}

/** Interceptors and middlewares are tracked as bare class names. */
export const byName = ( name: string ) => name;
export const guardName = ( guard: any ) => guard.name;

export interface ClassMetadata {
    corsConfigs     : any[]
    securityConfigs : any[]
    fileConfigs     : any[]
    revivers        : any[]
    guards          : any[]
    interceptors    : string[]
    middlewares     : string[]
    responseModes   : string[]
}

/**
 * Reads decorator metadata off the classes of one source file. Holds the checker, the
 * program-wide registry, and the file being transformed so the analysis passes and the
 * merge helpers can share them.
 */
export class MetadataCollector
{
    public constructor(
        private readonly checker: ts.TypeChecker,
        private readonly registry: ProjectRegistry,
        private readonly diagnostics: DiagnosticReporter
    ) {}

    /** Guard param lists reuse this, which is why `skipCount` exists for WS handlers. */
    public resolveParamsMetadata( params: ts.NodeArray<ts.ParameterDeclaration>, isWsMethod: boolean = false, skipCount: number = 0 ): any[]
    {
        const checker = this.checker;
        const registry = this.registry;
        const metadata: any[] = [];
        const pArray = Array.from( params );

        for( let i = 0; i < pArray.length; i++ ) 
        {
            if( i < skipCount ) { continue }
            const p = pArray[i];
            const decs = ts.getDecorators( p );
            let dName = '', pName = '', vMode: any = undefined;

            let isInject = false;
            let injectToken = '';

            if( decs ) 
            {
                for( const dec of decs ) 
                {
                    const e = dec.expression;
                    const ident = ts.isCallExpression( e ) ? e.expression : e;

                    if( ts.isIdentifier( ident ) && ident.text === 'Inject' ) 
                    {
                        isInject = true;

                        if( ts.isCallExpression( e ) && e.arguments.length > 0 ) 
                        {
                            const arg = e.arguments[0];

                            if( ts.isStringLiteral( arg )) { injectToken = arg.text }
                            else if( ts.isIdentifier( arg )) { injectToken = arg.text }
                            else { injectToken = arg.getText() }
                        }
                        break;
                    }
                }
            }

            if( isInject && !injectToken && p.type ) 
            {
                const type = checker.getTypeAtLocation( p );
                const resolved = resolveTokenFromType( p.type, type, checker );

                if( resolved ) 
                {
                    injectToken = resolved;
                }
            }
            else if( !isInject && p.type ) 
            {
                const type = checker.getTypeAtLocation( p );
                const typeName = resolveTokenFromType( p.type, type, checker );

                if( typeName && registry.providers.has( typeName )) 
                {
                    isInject = true;
                    injectToken = typeName;
                }
            }

            if( decs ) 
            {
                for( const dec of decs ) 
                {
                    const e = dec.expression;
                    const ident = ts.isCallExpression( e ) ? e.expression : e;

                    if( ts.isIdentifier( ident ) && PARAM_DECORATORS[ident.text]) 
                    {
                        dName = PARAM_DECORATORS[ident.text];

                        if( ts.isCallExpression( e )) 
                        {
                            if([ 'Peer', 'Cookies', 'Headers', 'Ip', 'Url', 'Hostname', 'Path', 'RawBody', 'Request', 'Context', 'Response' ].includes( dName )) 
                            {
                                this.diagnostics.error(
                                    e,
                                    DiagnosticCode.DECORATOR_MISUSE,
                                    `Decorator "@${dName}" must not be called with parentheses. Use "@${dName}" instead of "@${dName}()".`
                                );
                            }

                            if( dName === 'Body' ) 
                            {
                                if( e.arguments[0] && ts.isStringLiteral( e.arguments[0])) 
                                {
                                    vMode = e.arguments[0].text as any;
                                }
                            }
                            else if( dName === 'Query' ) 
                            {
                                if( e.arguments[0] && ts.isStringLiteral( e.arguments[0])) 
                                {
                                    pName = e.arguments[0].text;
                                }

                                if( e.arguments[1] && ts.isStringLiteral( e.arguments[1])) 
                                {
                                    vMode = e.arguments[1].text as any;
                                }
                            }
                            else if( dName === 'Files' )
                            {
                                // `@Files()` — no field name
                            }
                            else if( dName === 'File' )
                            {
                                if( e.arguments[0] && ts.isStringLiteral( e.arguments[0]))
                                {
                                    pName = e.arguments[0].text;
                                }
                            }
                            else if( ![ 'Peer', 'Cookies', 'Headers', 'Ip', 'Url', 'Hostname', 'Path', 'RawBody', 'Request', 'Context', 'Response' ].includes( dName ) && e.arguments[0] && ts.isStringLiteral( e.arguments[0])) 
                            {
                                pName = e.arguments[0].text;
                            }
                        }
                        break;
                    }
                }
            }

            if( !dName && isInject ) 
            {
                dName = 'Inject';
                pName = injectToken || 'any';
            }

            if( !dName && isWsMethod ) 
            {
                const pTypeName = p.type ? p.type.getText() : '';
                const pNameText = p.name.getText();

                if( pTypeName.includes( 'ServerWebSocket' ) || pNameText === 'ws' || pNameText === 'socket' || i === 0 ) 
                {
                    dName = 'WebSocket';
                }
            }

            if( dName ) 
            {
                if(['Body', 'Query', 'Param', 'Cookie', 'Header', 'Headers', 'Cookies'].includes( dName )) 
                {
                    const type = checker.getTypeAtLocation( p );
                    const typeHash = generateHash( type, checker );
                    const mode = vMode || 'strip';

                    if( dName === 'Body' ) 
                    {
                        buildParser( type, checker, registry.parsers, typeHash, { mode, from : 'json' });
                        buildParser( type, checker, registry.parsers, typeHash, { mode, from : 'query' });
                        // Multipart (and assert-style) path: validators support UploadedFile via instanceof.
                        buildValidator( type, checker, registry.validators, typeHash );
                        metadata.push({
                            source      : dName,
                            name        : pName,
                            parser      : `${typeHash}_${mode}_json`,
                            parserQuery : `${typeHash}_${mode}_query`,
                            validator   : typeHash,
                            mode        : vMode
                        });
                    }
                    else if( dName === 'Query' )
                    {
                        if( pName )
                        {
                            // Named query: scalar wire value → from:'string'. Arrays/objects stay on assert.
                            try
                            {
                                buildParser( type, checker, registry.parsers, typeHash, { mode, from : 'string' });
                                metadata.push({
                                    source : dName,
                                    name   : pName,
                                    parser : `${typeHash}_${mode}_string`,
                                    mode   : vMode
                                });
                            }
                            catch
                            {
                                buildValidator( type, checker, registry.validators, typeHash );
                                metadata.push({
                                    source    : dName,
                                    name      : pName,
                                    validator : typeHash,
                                    mode      : vMode
                                });
                            }
                        }
                        else
                        {
                            // Whole `@Query()` bag: raw search text (no leading `?`).
                            buildParser( type, checker, registry.parsers, typeHash, { mode, from : 'query' });
                            metadata.push({
                                source : dName,
                                name   : pName,
                                parser : `${typeHash}_${mode}_query`,
                                mode   : vMode
                            });
                        }
                    }
                    else if( dName === 'Headers' || dName === 'Cookies' )
                    {
                        // Already-decoded string maps — assert, not parse (parse is wire text only).
                        buildValidator( type, checker, registry.validators, typeHash );
                        metadata.push({
                            source    : dName,
                            name      : pName,
                            validator : typeHash,
                            mode      : vMode
                        });
                    }
                    else 
                    {
                        // Param / Cookie / Header: single already-decoded scalars — never parseQueryString.
                        buildParser( type, checker, registry.parsers, typeHash, { mode, from : 'string' });
                        metadata.push({
                            source : dName,
                            name   : pName,
                            parser : `${typeHash}_${mode}_string`,
                            mode   : vMode
                        });
                    }
                }
                else 
                {
                    metadata.push({ source : dName, name : pName, validator : '', mode : vMode });
                }
            }
            else 
            {
                metadata.push({ source : 'Request', name : '', validator : '', mode : undefined });
            }
        }

        return metadata;
    }

    /**
     * Resolve a decorator argument that must name a class, reporting it when it does not.
     * A typo here used to drop a guard silently, which turns into a missing security check.
     */
    public requireClassRef( expr: ts.Expression, map: Map<string, any>, decorator: string ): string | null
    {
        const name = this.resolveClassRef( expr, map );

        if( !name )
        {
            this.diagnostics.error(
                expr,
                DiagnosticCode.UNRESOLVED_CLASS,
                `Argument of "@${decorator}" must reference a class declaration. "${expr.getText()}" could not be resolved, so it would be ignored at runtime.`
            );
        }

        return name;
    }

    /**
     * Resolve a decorator argument to the name of a class the registry knows, registering
     * it on first sight. Returns null when the argument is not a class reference.
     */
    public resolveClassRef( expr: ts.Expression, map: Map<string, any> ): string | null
    {
        let ident: ts.Identifier | null = null;

        if( ts.isIdentifier( expr )) { ident = expr }

        if( ident ) 
        {
            let symbol = this.checker.getSymbolAtLocation( ident );

            // Imported bindings are aliases whose first declaration is the ImportSpecifier,
            // not the class. Follow them so `@Protect(ImportedGuard)` resolves like a
            // same-file class reference.
            if( symbol && ( symbol.flags & ts.SymbolFlags.Alias ))
            {
                symbol = this.checker.getAliasedSymbol( symbol );
            }

            const decl = symbol?.declarations?.[0];

            if( decl && ts.isClassDeclaration( decl )) 
            {
                const name = decl.name?.text ?? ident.text;

                if( !map.has( name )) 
                {
                    let params: any[] = [];

                    if( map === this.registry.guards ) 
                    {
                        const useMethod = decl.members.find( m => ts.isMethodDeclaration( m ) && m.name.getText() === 'use' ) as ts.MethodDeclaration;

                        if( useMethod ) 
                        {
                            params = this.resolveParamsMetadata( useMethod.parameters );
                        }
                    }
                    map.set( name, { path : decl.getSourceFile().fileName, params });
                }

                return name;
            }
        }

        return null;
    }

    /** `@Protect( RoleGuard, 'admin' )` — the class plus its literal arguments. */
    public resolveGuardMetadata( expr: ts.CallExpression, decorator = 'Protect' ): any | null
    {
        if( expr.arguments.length === 0 ) { return null }

        const firstArg = expr.arguments[0];
        const name = this.requireClassRef( firstArg, this.registry.guards, decorator );

        if( name ) 
        {
            const staticArgs: any[] = [];

            for( let i = 1; i < expr.arguments.length; i++ ) 
            {
                const arg = expr.arguments[i];

                if( ts.isStringLiteral( arg )) { staticArgs.push( arg.text ) }
                else if( ts.isNumericLiteral( arg )) { staticArgs.push( Number( arg.text )) }
                else if( arg.kind === ts.SyntaxKind.TrueKeyword ) { staticArgs.push( true ) }
                else if( arg.kind === ts.SyntaxKind.FalseKeyword ) { staticArgs.push( false ) }
                else if( ts.isArrayLiteralExpression( arg )) 
                {
                    staticArgs.push( arg.elements.map( e => ( e as any ).text || e.getText()));
                }
            }
            const guardInfo = this.registry.guards.get( name );

            return { type : 'class', name, resolvers : staticArgs, params : guardInfo?.params || [], isAsync : false };
        }

        return null;
    }

    /** Property types that name a registered singleton are injected into the controller. */
    public scanInjections( cls: ts.ClassDeclaration, controllerName: string ): void
    {
        const registry = this.registry;
        const info = registry.controllers.get( controllerName );

        if( !info ) { return }

        const type = this.checker.getTypeAtLocation( cls );
        const properties = this.checker.getPropertiesOfType( type );

        for( const prop of properties ) 
        {
            const propDecl = prop.valueDeclaration;

            if( propDecl && ( ts.isPropertyDeclaration( propDecl ) || ts.isPropertySignature( propDecl ))) 
            {
                const propType = this.checker.getTypeAtLocation( propDecl );
                const typeName = resolveTokenFromType( propDecl.type, propType, this.checker );

                if( typeName ) 
                {
                    // Check if type matches a registered singleton
                    if( registry.guards.has( typeName ) || registry.interceptors.has( typeName ) || registry.controllers.has( typeName )) 
                    {
                        info.injections.set( prop.getName(), typeName );
                    }
                }
            }
        }
    }

    public guardDirectives( decorators: readonly ts.Decorator[] | undefined ): MergeDirectives<any>
    {
        return readDirectives( decorators, {
            add      : 'Protect',
            override : 'OverrideProtect',
            remove   : 'Unprotect',
            collect  : ( call, decorator ) =>
            {
                const guard = this.resolveGuardMetadata( call, decorator );

                return guard ? [ guard ] : [];
            },
            removalOf : ( arg, decorator ) => this.requireClassRef( arg, this.registry.guards, decorator )
        });
    }

    public interceptorDirectives( decorators: readonly ts.Decorator[] | undefined ): MergeDirectives<string>
    {
        return readDirectives( decorators, {
            add      : 'Intercept',
            override : 'OverrideIntercept',
            remove   : 'Unintercept',
            // Only the first argument: an interceptor takes no static arguments.
            collect  : ( call, decorator ) =>
            {
                if( call.arguments.length === 0 ) { return [] }
                const name = this.requireClassRef( call.arguments[0], this.registry.interceptors, decorator );

                return name ? [ name ] : [];
            },
            removalOf : ( arg, decorator ) => this.requireClassRef( arg, this.registry.interceptors, decorator )
        });
    }

    public middlewareDirectives( decorators: readonly ts.Decorator[] | undefined ): MergeDirectives<string>
    {
        return readDirectives( decorators, {
            add      : 'Use',
            override : 'OverrideUse',
            remove   : 'Unuse',
            collect  : ( call, decorator ) =>
            {
                const names: string[] = [];

                for( const arg of call.arguments )
                {
                    const name = this.requireClassRef( arg, this.registry.providers, decorator );

                    if( name ) { names.push( name ) }
                }

                return names;
            },
            removalOf : ( arg, decorator ) => this.requireClassRef( arg, this.registry.providers, decorator )
        });
    }

    /** Merge a class with everything it extends, nearest ancestor last. */
    public collectClassMetadata( classDecl: ts.ClassDeclaration ): ClassMetadata
    {
        const sourceFile = classDecl.getSourceFile();
        const corsConfigs: any[] = [];
        const securityConfigs: any[] = [];
        const fileConfigs: any[] = [];
        const revivers: any[] = [];
        let guards: any[] = [];
        let interceptors: string[] = [];
        let middlewares: string[] = [];
        const responseModes: string[] = [];

        const type = this.checker.getTypeAtLocation( classDecl );
        const baseTypes = type.getBaseTypes();

        if( baseTypes ) 
        {
            for( const baseType of baseTypes ) 
            {
                const symbol = baseType.getSymbol() || baseType.aliasSymbol;
                const baseDecl = symbol?.valueDeclaration || symbol?.declarations?.[0];

                if( baseDecl && ts.isClassDeclaration( baseDecl )) 
                {
                    const parentMeta = this.collectClassMetadata( baseDecl );
                    corsConfigs.push( ...parentMeta.corsConfigs );
                    securityConfigs.push( ...parentMeta.securityConfigs );
                    fileConfigs.push( ...parentMeta.fileConfigs );
                    revivers.push( ...parentMeta.revivers );
                    guards.push( ...parentMeta.guards );
                    interceptors.push( ...parentMeta.interceptors );
                    middlewares.push( ...parentMeta.middlewares );
                    responseModes.push( ...parentMeta.responseModes );
                }
            }
        }

        const decorators = ts.getDecorators( classDecl );

        const directCors = extractCorsConfig( decorators, sourceFile );

        if( directCors !== undefined ) 
        {
            corsConfigs.push( directCors );
        }

        const directSecurity = extractSecurityConfig( decorators, sourceFile );

        if( directSecurity !== undefined ) 
        {
            securityConfigs.push( directSecurity );
        }

        const directFile = extractFileConfig( decorators, sourceFile );

        if( directFile !== undefined )
        {
            fileConfigs.push( directFile );
        }

        const directReviver = extractReviver( decorators, sourceFile );

        if( directReviver !== undefined )
        {
            revivers.push( directReviver );
        }

        guards = applyDirectives( guards, this.guardDirectives( decorators ), guardName );
        interceptors = applyDirectives( interceptors, this.interceptorDirectives( decorators ), byName );
        middlewares = applyDirectives( middlewares, this.middlewareDirectives( decorators ), byName );

        const directResponseMode = extractResponseMode( decorators );

        if( directResponseMode !== undefined ) 
        {
            responseModes.push( directResponseMode );
        }

        return {
            corsConfigs,
            securityConfigs,
            fileConfigs,
            revivers,
            guards,
            interceptors,
            middlewares,
            responseModes
        };
    }
}