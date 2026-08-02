import ts from 'typescript';
import * as path from 'path';
import { ProjectRegistry } from './registry.js';

/** Import specifier for `from`, relative to the manifest and pointing at emitted JS. */
function relativeImport( manifestDir: string, from: string ): string
{
    let rel = path.relative( manifestDir, from ).replace( /\.ts$/, '.js' );

    if( !rel.startsWith( '.' ) && !rel.startsWith( '/' )) 
    {
        rel = './' + rel;
    }

    return rel;
}

/**
 * Legacy sidecar manifest: a single module that imports every discovered class and
 * registers it on `MetadataStore`. The Symbol.for emit in `plugin.ts` supersedes this for
 * normal builds; the manifest remains for consumers that publish one.
 */
export function generateManifestCode( registry: ProjectRegistry, controllerMap: Map<string, string>, manifestPath: string ): string 
{
    const manifestDir = path.dirname( manifestPath );
    const finalControllerMap = controllerMap.size > 0 ? controllerMap : new Map( Array.from( registry.controllers.entries()).map(([k, v]) => [k, v.path]));

    let imports = 'import { MetadataStore } from \'@webergency-utils/server\';\n';

    // Custom constraint/transform helpers must already be imported by the emitting file;
    // validator/parser/serializer expressions reference them by bare identifier.
    if( registry.validators.size > 0 || registry.parsers.size > 0 || registry.serializers.size > 0 )
    {
        imports += 'import * as __tcRuntime from \'@webergency-utils/typechecker/runtime\';\n';

        if( registry.validators.size > 0 )
        {
            imports += 'const validators = __tcRuntime.validators;\n';
        }
    }

    let logic = '\n// --- SINGLETONS ---\n';
    const importedAndRegistered = new Set<string>();

    const collect = ( entries: Iterable<[ string, string ]>, register: string ) =>
    {
        for( const [ name, from ] of entries )
        {
            if( importedAndRegistered.has( name )) { continue }
            imports += `import { ${name} } from '${relativeImport( manifestDir, from )}';\n`;
            logic += `MetadataStore.${register}('${name}', ${name});\n`;
            importedAndRegistered.add( name );
        }
    };

    const pathsOf = ( map: Map<string, { path : string }> ): [ string, string ][] =>
        Array.from( map.entries()).map(([ name, info ]) => [ name, info.path ]);

    collect( pathsOf( registry.guards ), 'registerGuard' );
    collect( pathsOf( registry.interceptors ), 'registerInterceptor' );
    collect( finalControllerMap.entries(), 'registerController' );
    collect( pathsOf( registry.providers ), 'registerProvider' );
    collect( pathsOf( registry.modules ), 'registerModule' );

    // External Manifests (using dynamic import for top-level await)
    let external = '\n// --- EXTERNAL MANIFESTS ---\n';

    for( const externalPath of registry.externalManifests ) 
    {
        const relPath = path.relative( manifestDir, externalPath );
        external += `try { await import('./${relPath}'); } catch(e) { console.warn("⚠️ Failed to load external manifest: ${relPath}", e.message); }\n`;
    }

    const printer = ts.createPrinter({ newLine : ts.NewLineKind.LineFeed });

    const formatCode = ( node: ts.Node ) => 
    {
        return printer.printNode( ts.EmitHint.Expression, node, undefined as any );
    };

    let emitLocalsCode = '';

    if( registry.validators.size > 0 )
    {
        emitLocalsCode += '\n// --- VALIDATORS ---\n';

        for( const [hash, expr] of registry.validators.entries()) 
        {
            emitLocalsCode += `var __val_${hash} = ${formatCode( expr )};\n\n`;
        }
    }

    if( registry.parsers.size > 0 )
    {
        emitLocalsCode += '\n// --- PARSERS ---\n';

        for( const [hash, expr] of registry.parsers.entries()) 
        {
            emitLocalsCode += `var __parse_${hash} = ${formatCode( expr )};\n\n`;
        }
    }

    if( registry.serializers.size > 0 )
    {
        emitLocalsCode += '\n// --- SERIALIZERS ---\n';

        for( const [hash, expr] of registry.serializers.entries()) 
        {
            emitLocalsCode += `var __ser_${hash} = ${formatCode( expr )};\n\n`;
        }
    }

    let endpointsCode = '\n// --- ENDPOINTS ---\n';

    for( const ep of registry.endpoints ) 
    {
        for( const g of ep.guards ) 
        {
            if( g.type === 'class' && registry.guards.has( g.name )) 
            {
                g.params = registry.guards.get( g.name )!.params || [];
            }
        }

        // Replace hash strings with actual code references
        let epJson = JSON.stringify( ep, null, 4 );
        epJson = epJson.replace( /"(validator|returnTypeValidator)":\s*"([^"]+)"/g, ( match, key, hash ) => 
        {
            return hash ? `"${key}": __val_${hash}` : match;
        });
        epJson = epJson.replace( /"(returnTypeSerializer)":\s*"([^"]+)"/g, ( match, key, hash ) => 
        {
            return hash ? `"${key}": __ser_${hash}` : match;
        });
        epJson = epJson.replace( /"(parser|parserQuery)":\s*"([^"]+)"/g, ( match, key, hash ) => 
        {
            return hash ? `"${key}": __parse_${hash}` : match;
        });

        // Replace __raw_code__ placeholders before cleaning up quotes
        epJson = epJson.replace( /\{\s*"__raw_code__":\s*"([^"]+)"\s*\}/g, ( match, rawCode ) => 
        {
            try 
            {
                return JSON.parse( '"' + rawCode + '"' );
            }
            catch 
            {
                return rawCode;
            }
        });

        // Clean up JSON for JS (remove quotes from keys, use single quotes)
        epJson = epJson
            .replace( /"([^"]+)":/g, '$1:' )
            .replace( /"/g, "'" )
            .replace( / {4}/g, '\t' );

        endpointsCode += `MetadataStore.registerEndpoint(${epJson});\n\n`;
    }

    return imports + external + logic + emitLocalsCode + endpointsCode;
}

const HASH_IDENT_KEYS: Record<string, string> = {
    validator            : '__val_',
    returnTypeValidator  : '__val_',
    returnTypeSerializer : '__ser_',
    parser               : '__parse_',
    parserQuery          : '__parse_'
};

/** Rebuild a parsed decorator value as an expression, restoring `__raw_code__` verbatim. */
export function objectToExpression( obj: any ): ts.Expression 
{
    if( obj === null ) { return ts.factory.createNull() }

    if( obj === undefined ) { return ts.factory.createIdentifier( 'undefined' ) }

    if( typeof obj === 'string' ) { return ts.factory.createStringLiteral( obj ) }

    if( typeof obj === 'number' ) { return ts.factory.createNumericLiteral( obj.toString()) }

    if( typeof obj === 'boolean' ) { return obj ? ts.factory.createTrue() : ts.factory.createFalse() }

    if( Array.isArray( obj )) 
    {
        return ts.factory.createArrayLiteralExpression( obj.map( item => objectToExpression( item )));
    }

    if( typeof obj === 'object' ) 
    {
        if( typeof obj.__raw_code__ === 'string' ) 
        {
            const tempSourceFile = ts.createSourceFile( 'temp_ast.ts', `(${obj.__raw_code__})`, ts.ScriptTarget.Latest, true );
            const statement = tempSourceFile.statements[0];

            if( statement && ts.isExpressionStatement( statement )) 
            {
                return statement.expression;
            }

            return ts.factory.createIdentifier( obj.__raw_code__ );
        }
        const properties: ts.ObjectLiteralElementLike[] = [];

        for( const [key, value] of Object.entries( obj )) 
        {
            const prefix = HASH_IDENT_KEYS[key];

            if( prefix && typeof value === 'string' && value !== '' ) 
            {
                properties.push(
                    ts.factory.createPropertyAssignment(
                        ts.factory.createIdentifier( key ),
                        ts.factory.createIdentifier( `${prefix}${value}` )
                    )
                );
            }
            else 
            {
                properties.push(
                    ts.factory.createPropertyAssignment(
                        ts.factory.createIdentifier( key ),
                        objectToExpression( value )
                    )
                );
            }
        }

        return ts.factory.createObjectLiteralExpression( properties, true );
    }
    throw new Error( `Unsupported object type: ${typeof obj}` );
}
