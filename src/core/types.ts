export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS' | 'HEAD' | 'ALL' | 'RPC';

export interface ServerWebSocket {
  send(data: string | ArrayBuffer | Buffer): void;
  close(code?: number, reason?: string): void;
  on(event: 'message' | 'close' | 'error', callback: Function): void;
  off(event: 'message' | 'close' | 'error', callback: Function): void;
  readonly headers: Headers;
  readonly query: Record<string, string>;
  readonly params: Record<string, string>;
}

export type ValidationMode = 'strict' | 'relaxed' | 'strip';

export interface ParamMetadata {
  source: 'Param' | 'Body' | 'Query' | 'Header' | 'Headers' | 'Request' | 'Response' | 'Ip' | 'Url' | 'Hostname' | 'Path' | 'Context' | 'Inject' | 'WebSocket';
  name?: string;
  validator?: string | Validator;
  mode?: ValidationMode;
}

export interface GuardMetadata {
  type: 'class' | 'method';
  name: string;
  resolvers: any[];
  params: ParamMetadata[];
  isAsync: boolean;
}

export interface EndpointMetadata {
  controller: string;
  methodName: string;
  httpMethod: Method;
  path: string;
  params: ParamMetadata[];
  guards: GuardMetadata[];
  interceptors: string[];
  cors?: any;
  security?: any;
  meta: Record<string, any>;
}

export type Validator = (v: any, path: string, ctx: any) => any;

export interface AugmentedRequest extends Request {
  params: Record<string, string>;
  query: Record<string, string>;
  globalCors?: any;
  cors?: any;
  globalSecurity?: any;
  security?: any;
  meta: Record<string, any>;
  _json?: any;
  _raw?: ArrayBuffer;
}

export interface LogContext {
  type: 'server_start' | 'server_shutdown' | 'registration' | 'request_start' | 'request_end' | 'error';
  port?: number;
  runtime?: string;
  reason?: string;
  method?: string;
  path?: string;
  url?: string;
  status?: number;
  duration?: number;
  controller?: string;
  action?: string;
  error?: Error;
  [key: string]: any;
}

export interface Logger {
  info(message: any, context?: LogContext): void;
  warn(message: any, context?: LogContext): void;
  error(message: any, context?: LogContext): void;
  debug?(message: any, context?: LogContext): void;
}

