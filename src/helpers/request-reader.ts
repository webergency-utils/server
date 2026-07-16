import { AugmentedRequest } from '../core/types.js';
import { SecurityOptions } from '../decorators.js';
import { parseSize } from './security.js';

export class RequestReader 
{
    public static async getBody( req: AugmentedRequest, securityConfig?: SecurityOptions ): Promise<any> 
    {
        if( '_json' in req ) { return req._json }
        const raw = await this.getRawBody( req, securityConfig );

        if( !raw.byteLength ){ return req._json = undefined }

        return req._json = JSON.parse( new TextDecoder().decode( raw ));
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
