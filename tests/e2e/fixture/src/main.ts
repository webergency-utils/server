import { Server } from '@webergency-utils/server';
import { AppModule } from './app.module.js';

const port = parseInt( process.env.PORT || '0', 10 );

const server = new Server({
    port,
    module : AppModule
});

server.on( 'start', ( bound ) =>
{
    process.stdout.write( `E2E_LISTEN ${bound}\n` );
});

server.start();
