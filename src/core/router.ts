import { Method, EndpointMetadata, AugmentedRequest } from './types.js';

export interface Route {
  method: Method;
  path: string;
  metadata: EndpointMetadata;
  regex: RegExp;
  paramNames: string[];
}

export class Router {
  private routes: Route[] = [];

  public add(metadata: EndpointMetadata) {
    const paramNames: string[] = [];
    const regexSource = metadata.path
      .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      })
      .replace(/\//g, '\\/');
    
    this.routes.push({
      method: metadata.httpMethod,
      path: metadata.path,
      metadata,
      regex: new RegExp(`^${regexSource}$`),
      paramNames,
    });
  }

  public find(method: string, path: string) {
    const route = this.routes.find(r => r.method === method && r.regex.test(path));
    if (!route) return null;

    const match = path.match(route.regex);
    const params: Record<string, string> = {};
    if (match) {
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
    }

    return { metadata: route.metadata, params };
  }
}
