import { Controller, Get, Injectable, Protect, Public, Header } from '@webergency-utils/server';
import type { Guard } from '@webergency-utils/server';

@Injectable()
export class ApiKeyGuard implements Guard
{
    use( @Header( 'x-api-key' ) key?: string )
    {
        if( key !== 'ok' )
        {
            throw Object.assign( new Error( 'forbidden' ), { status : 403 });
        }
    }
}

@Controller( '/secure' )
@Protect( ApiKeyGuard )
export class SecureController
{
    @Get( '/ping' )
    ping()
    {
        return { ok : true };
    }

    @Public
    @Get( '/open' )
    open()
    {
        return { open : true };
    }
}
