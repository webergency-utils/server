export interface MessageConnection {
    send( data: any ): void | Promise<void>
    close(): void | Promise<void>
}

/** Returned by EventPattern handlers so adapters never write a reply envelope. */
export const MicroserviceNoReply = Symbol.for( 'webergency.microservice.noreply' );

export type MicroserviceHandlerResult = typeof MicroserviceNoReply | any;

export interface MicroserviceAdapter {
    listen( handler: ( pattern: string, payload: any, connection: MessageConnection ) => Promise<MicroserviceHandlerResult> ): Promise<void>
    close(): Promise<void>
}
