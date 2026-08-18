const { FuzzedDataProvider } = require( '@jazzer.js/core' );
const runtime = require( '../dist-fuzz/runtime.cjs' );

function createFuzzedInput( provider, depth = 0, maxDepth = 3 )
{
    if( depth >= maxDepth )
    {
        const leaf = provider.consumeIntegralInRange( 0, 6 );

        if( leaf === 0 ){ return provider.consumeString( 32 ) }

        if( leaf === 1 ){ return provider.consumeNumber() }

        if( leaf === 2 ){ return provider.consumeBoolean() }

        if( leaf === 3 ){ return null }

        if( leaf === 4 ){ return undefined }

        if( leaf === 5 ){ return provider.consumeIntegralInRange( -1000, 1000 ) }

        return Buffer.from( provider.consumeBytes( 8 ));
    }

    const kind = provider.consumeIntegralInRange( 0, 8 );

    if( kind === 0 ){ return provider.consumeString( 48 ) }

    if( kind === 1 ){ return provider.consumeNumber() }

    if( kind === 2 ){ return provider.consumeBoolean() }

    if( kind === 3 ){ return null }

    if( kind === 4 )
    {
        const len = provider.consumeIntegralInRange( 0, 4 );
        const arr = [];

        for( let i = 0; i < len; i++ )
        {
            arr.push( createFuzzedInput( provider, depth + 1, maxDepth ));
        }

        return arr;
    }

    if( kind === 5 )
    {
        const len = provider.consumeIntegralInRange( 0, 4 );
        const obj = {};

        for( let i = 0; i < len; i++ )
        {
            obj[provider.consumeString( 8 ) || `k${i}`] = createFuzzedInput( provider, depth + 1, maxDepth );
        }

        return obj;
    }

    if( kind === 6 ){ return new Date( provider.consumeNumber()) }

    if( kind === 7 )
    {
        try
        {
            return new RegExp( provider.consumeString( 12 ));
        }
        catch
        {
            return /./;
        }
    }

    return new Set([ createFuzzedInput( provider, depth + 1, maxDepth )]);
}

function fuzzQueryString( provider )
{
    const parts = [];
    const count = provider.consumeIntegralInRange( 0, 8 );

    for( let i = 0; i < count; i++ )
    {
        const key = provider.consumeString( 16 ) || `k${i}`;
        const style = provider.consumeIntegralInRange( 0, 3 );

        if( style === 0 )
        {
            parts.push( encodeURIComponent( key ));
        }
        else if( style === 1 )
        {
            parts.push( `${encodeURIComponent( key )}=${encodeURIComponent( provider.consumeString( 24 ))}` );
        }
        else if( style === 2 )
        {
            parts.push( `${encodeURIComponent( key )}[]=${encodeURIComponent( provider.consumeString( 12 ))}` );
        }
        else
        {
            parts.push( `${encodeURIComponent( key )}[${provider.consumeString( 6 )}]=${encodeURIComponent( provider.consumeString( 12 ))}` );
        }
    }

    return parts.join( '&' );
}

function fuzzPathPattern( provider )
{
    const segments = [];
    const count = provider.consumeIntegralInRange( 1, 6 );

    for( let i = 0; i < count; i++ )
    {
        const kind = provider.consumeIntegralInRange( 0, 3 );

        if( kind === 0 ){ segments.push( provider.consumeString( 12 ).replace( /\//g, '' ) || 'seg' ) }
        else if( kind === 1 ){ segments.push( `:${provider.consumeString( 8 ).replace( /[^a-zA-Z0-9_]/g, '' ) || 'id'}` ) }
        else if( kind === 2 ){ segments.push( `*${provider.consumeString( 6 ).replace( /[^a-zA-Z0-9_]/g, '' ) || 'rest'}` ) }
        else { segments.push( provider.consumeBoolean() ? '' : provider.consumeString( 8 )) }
    }

    return '/' + segments.filter( Boolean ).join( '/' );
}

module.exports.fuzz = function( data )
{
    try
    {
        const provider = new FuzzedDataProvider( data );
        const {
            parseQueryString,
            createFormBag,
            parseSize,
            mergeSecurityConfigs,
            generateSecurityHeaders,
            pathCompiler,
            pathMatcher,
            pathToRE,
            getContentType,
            Router,
            ApplicationRegistry
        } = runtime;

        const qs = fuzzQueryString( provider );
        parseQueryString( qs );
        parseQueryString( provider.consumeString( 64 ));
        createFormBag().assign( provider.consumeString( 24 ), provider.consumeString( 24 ));

        const sizeInput = provider.pickValue([
            provider.consumeNumber(),
            `${provider.consumeIntegralInRange( 0, 9999 )}b`,
            `${provider.consumeIntegralInRange( 0, 999 )}kb`,
            `${provider.consumeIntegralInRange( 0, 99 )}mb`,
            `${provider.consumeIntegralInRange( 0, 9 )}gb`,
            provider.consumeString( 16 )
        ]);

        try
        {
            parseSize( sizeInput );
        }
        catch( e )
        {
            if( !( e instanceof Error )){ throw e }
        }

        const securityConfigs = [
            undefined,
            true,
            false,
            { maxBodySize : '1mb', frameguard : true },
            { hsts : { maxAge : provider.consumeIntegralInRange( 0, 1e9 ) } },
            createFuzzedInput( provider )
        ];
        const merged = mergeSecurityConfigs( securityConfigs );
        generateSecurityHeaders( merged );
        generateSecurityHeaders( true );
        generateSecurityHeaders( false );
        generateSecurityHeaders( undefined );

        const pattern = fuzzPathPattern( provider );
        const path = provider.consumeString( 48 ) || '/';

        try
        {
            pathToRE( pattern );
            const matcher = pathMatcher( pattern );
            matcher( path );
            matcher( '/' + provider.consumeString( 24 ));
            const compiler = pathCompiler( pattern );
            compiler( createFuzzedInput( provider ) && typeof createFuzzedInput( provider ) === 'object'
                ? createFuzzedInput( provider )
                : { id : provider.consumeString( 8 ) });
        }
        catch( e )
        {
            if( !( e instanceof TypeError || e instanceof RangeError || e instanceof URIError || e instanceof SyntaxError ))
            {
                // path helpers may throw plain Error for invalid patterns
                if( !( e instanceof Error )){ throw e }
            }
        }

        const fakeReq = {
            headers : {
                get : ( name ) =>
                {
                    if( name === 'content-type' )
                    {
                        return provider.pickValue([
                            null,
                            'application/json',
                            'application/json; charset=utf-8',
                            'application/x-www-form-urlencoded',
                            'text/plain',
                            provider.consumeString( 32 )
                        ]);
                    }

                    return null;
                }
            }
        };
        getContentType( fakeReq );

        const registry = new ApplicationRegistry();
        const router = new Router();
        const methods = [ 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL' ];
        const routeCount = provider.consumeIntegralInRange( 0, 5 );

        for( let i = 0; i < routeCount; i++ )
        {
            try
            {
                router.add({
                    httpMethod   : provider.pickValue( methods ),
                    path         : fuzzPathPattern( provider ),
                    controller   : `C${i}`,
                    methodName   : `m${i}`,
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            }
            catch( e )
            {
                if( !( e instanceof Error )){ throw e }
            }
        }

        router.find( provider.pickValue( methods ), provider.consumeString( 32 ) || '/' );

        registry.registerController( 'FuzzCtrl', { ping : () => 'pong' });
        registry.getController( 'FuzzCtrl' );
        registry.getEndpoints();
        registry.clear();
    }
    catch( e )
    {
        if( e instanceof RangeError || e instanceof TypeError || e instanceof URIError || e instanceof SyntaxError )
        {
            return;
        }

        throw e;
    }
};
