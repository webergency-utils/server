import { Controller, Get, Post, Query, Body, Param, Header } from '@webergency-utils/server';

export type SearchQuery =
{
    apiKey? : string
    page?   : number
    active? : boolean
};

export type CreateUser =
{
    name  : string
    age?  : number
    tags? : string[]
};

export type NestedBody =
{
    user : { name : string, age? : number }
    tags : string[]
};

export type Tagged =
    | { type : 'a', a : string }
    | { type : 'b', b : number };

export type NestedQuery =
{
    user? : { name : string }
    q?    : string
};

@Controller( '/parse' )
export class ParseController
{
    @Get( '/api-key' )
    optionalApiKey( @Query( 'apiKey' ) apiKey?: string )
    {
        return { apiKey, present : apiKey !== undefined };
    }

    @Get( '/api-key-required' )
    requiredApiKey( @Query( 'apiKey' ) apiKey: string )
    {
        return { apiKey };
    }

    @Get( '/search' )
    searchBag( @Query() query: SearchQuery )
    {
        return query;
    }

    @Get( '/mixed' )
    mixed(
        @Query( 'page' ) page?: number,
        @Query( 'active' ) active?: boolean,
        @Query( 'tags' ) tags?: string[]
    )
    {
        return { page, active, tags };
    }

    @Get( '/echo/:id' )
    echoParam(
        @Param( 'id' ) id: string,
        @Query( 'flag' ) flag?: string,
        @Header( 'x-token' ) token?: string
    )
    {
        return { id, flag, token };
    }

    @Post( '/json' )
    jsonBody( @Body() body: CreateUser )
    {
        return body;
    }

    @Post( '/json-strict' )
    jsonStrict( @Body( 'strict' ) body: CreateUser )
    {
        return body;
    }

    @Post( '/form' )
    formBody( @Body() body: CreateUser )
    {
        return body;
    }

    @Post( '/nested' )
    nestedBody( @Body() body: NestedBody )
    {
        return body;
    }

    @Post( '/union' )
    unionBody( @Body() body: Tagged )
    {
        return body;
    }

    @Post( '/list' )
    listBody( @Body() body: CreateUser[] )
    {
        return body;
    }

    @Post( '/submit/:id' )
    submit(
        @Param( 'id' ) id: string,
        @Body() body: CreateUser,
        @Query( 'dry' ) dry?: boolean
    )
    {
        return { id, dry, body };
    }

    @Get( '/status' )
    statusUnion( @Query( 's' ) s: 'active' | 'inactive' )
    {
        return { s };
    }

    @Get( '/nested-query' )
    nestedQuery( @Query() query: NestedQuery )
    {
        return query;
    }

    @Get( '/flag' )
    boolFlag( @Query( 'on' ) on: boolean )
    {
        return { on };
    }
}
