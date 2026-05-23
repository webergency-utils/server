import { Method, EndpointMetadata } from './types.js';
import { pathMatcher, MatchFunction } from '../helpers/match.js';

export interface Route {
  method: Method;
  path: string;
  metadata: EndpointMetadata;
  matchFn: MatchFunction<any>;
}

export class Router {
  private routes: Route[] = [];

  public add(metadata: EndpointMetadata) {
    this.routes.push({
      method: metadata.httpMethod,
      path: metadata.path,
      metadata,
      matchFn: pathMatcher(metadata.path, { sensitive: true, end: true })
    });
  }

  public find(method: string, path: string) {
    for (const route of this.routes) {
      if (route.method !== 'ALL' && route.method !== method) continue;
      
      const match = route.matchFn(path);
      if (match) {
        return {
          metadata: route.metadata,
          params: match.params
        };
      }
    }
    return null;
  }
}
