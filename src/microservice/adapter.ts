export interface MessageConnection {
  send(data: any): void | Promise<void>;
  close(): void | Promise<void>;
}

export interface MicroserviceAdapter {
  listen(handler: (pattern: string, payload: any, connection: MessageConnection) => Promise<any>): Promise<void>;
  close(): Promise<void>;
}
