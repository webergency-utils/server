import { Controller, Get, Put, Patch, Delete, Post, Cookie, Cookies, Headers, RawBody, Sse, Param } from '@webergency-utils/server';

@Controller( '/http' )
export class HttpController
{
    @Get( '/item/:id' )
    getItem( @Param( 'id' ) id: string )
    {
        return { method : 'GET', id };
    }

    @Put( '/item/:id' )
    putItem( @Param( 'id' ) id: string )
    {
        return { method : 'PUT', id };
    }

    @Patch( '/item/:id' )
    patchItem( @Param( 'id' ) id: string )
    {
        return { method : 'PATCH', id };
    }

    @Delete( '/item/:id' )
    deleteItem( @Param( 'id' ) id: string )
    {
        return { method : 'DELETE', id };
    }

    @Get( '/cookie' )
    cookie( @Cookie( 'sid' ) sid?: string )
    {
        return { sid, present : sid !== undefined };
    }

    @Get( '/cookies' )
    cookies( @Cookies bag: Record<string, string> )
    {
        return bag;
    }

    @Get( '/headers' )
    headers( @Headers bag: Record<string, string> )
    {
        return { hasToken : !!bag['x-token'], accept : bag['accept'] };
    }

    @Post( '/raw' )
    raw( @RawBody raw: ArrayBuffer )
    {
        const text = new TextDecoder().decode( raw );

        return { raw : text, bytes : raw.byteLength };
    }

    @Sse( '/sse' )
    async *sse(): AsyncGenerator<{ event : string, data : { n : number } }>
    {
        yield { event : 'tick', data : { n : 1 } };
        yield { event : 'tick', data : { n : 2 } };
    }
}
