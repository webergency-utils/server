import { AugmentedRequest } from '../core/types.js';
import { SecurityOptions } from '../decorators.js';
import { parseSize } from './security.js';
import { QueryParser } from './parsers.js';

export function getContentType( req: AugmentedRequest ): string | null
{
    const raw = req.headers.get( 'content-type' );

    if( !raw ){ return null }

    return raw.split( ';' )[0]?.trim()?.toLowerCase() || null;
}

export class RequestReader 
{
    public static async getBody( req: AugmentedRequest, securityConfig?: SecurityOptions ): Promise<any> 
    {
        if( '_json' in req ) { return req._json }
        const raw = await this.getRawBody( req, securityConfig );

        if( !raw.byteLength ){ return req._json = undefined }

        const text = new TextDecoder().decode( raw );
        const contentType = getContentType( req );

        if( contentType === 'application/x-www-form-urlencoded' )
        {
            return req._json = QueryParser.parse( text );
        }

        return req._json = JSON.parse( text );
    }

    public static async getRawBody( req: AugmentedRequest, securityConfig?: SecurityOptions ): Promise<ArrayBuffer> 
    {
        if( req._raw !== undefined ) { return req._raw }
        const maxSize = securityConfig?.maxBodySize;

        if( maxSize !== undefined ) 
        {
            const limit = parseSize( maxSize );
            const contentLength = req.headers.get( 'content-length' );

            if( contentLength && parseInt( contentLength, 10 ) > limit ) 
            {
                throw Object.assign( new Error( `Payload Too Large (limit: ${maxSize})` ), { status : 413 });
            }
        }
        const buffer = await req.arrayBuffer();

        if( maxSize !== undefined ) 
        {
            const limit = parseSize( maxSize );

            if( buffer.byteLength > limit ) 
            {
                throw Object.assign( new Error( `Payload Too Large (limit: ${maxSize})` ), { status : 413 });
            }
        }

        return req._raw = buffer;
    }
}
