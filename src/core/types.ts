export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type ValidationMode = 'strict' | 'relaxed' | 'strip';

export interface ParamMetadata {
  source: 'Param' | 'Body' | 'Query' | 'Header' | 'Headers' | 'Request' | 'Response' | 'Ip' | 'Url' | 'Hostname' | 'Path' | 'Context';
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
  meta: Record<string, any>;
}

export type Validator = (v: any, path: string, ctx: any) => any;

export interface AugmentedRequest extends Request {
  params: Record<string, string>;
  query: Record<string, string>;
  globalCors?: any;
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

