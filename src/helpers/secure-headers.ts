import { SecureHeadersOptions } from '../decorators.js';

export function mergeSecureHeadersConfigs(configs: (SecureHeadersOptions | boolean | undefined)[]): SecureHeadersOptions | undefined {
  let merged: SecureHeadersOptions | undefined = undefined;

  for (const config of configs) {
    if (config === undefined) continue;

    if (config === true) {
      if (!merged) merged = {};
    } else if (config === false) {
      merged = {
        frameguard: false,
        noSniff: false,
        hsts: false,
        downloadOptions: false,
        permittedCrossDomainPolicies: false,
        referrerPolicy: false,
        xssFilter: false,
        csp: false,
        coep: false,
        coop: false,
        corp: false
      };
    } else if (typeof config === 'object') {
      if (!merged) merged = {};
      merged = { ...merged, ...config };
    }
  }

  return merged;
}

export function generateSecureHeaders(config: SecureHeadersOptions | boolean | undefined): Record<string, string> {
  if (config === undefined) return {};

  const headers: Record<string, string> = {};
  
  // If config is simply true, treat it as an empty object so all defaults apply
  const options: SecureHeadersOptions = config === true ? {} : (config === false ? {
    frameguard: false,
    noSniff: false,
    hsts: false,
    downloadOptions: false,
    permittedCrossDomainPolicies: false,
    referrerPolicy: false,
    xssFilter: false,
    csp: false,
    coep: false,
    coop: false,
    corp: false
  } : config);

  // Helper to check if a policy is enabled/defaulted
  const isEnabled = (prop: keyof SecureHeadersOptions): boolean => {
    return options[prop] !== false;
  };

  // 1. X-Frame-Options (frameguard)
  if (isEnabled('frameguard')) {
    const val = options.frameguard;
    if (val === undefined || val === true || val === 'sameorigin') {
      headers['X-Frame-Options'] = 'SAMEORIGIN';
    } else if (val === 'deny') {
      headers['X-Frame-Options'] = 'DENY';
    } else if (typeof val === 'object') {
      headers['X-Frame-Options'] = val.action.toUpperCase();
    }
  }

  // 2. X-Content-Type-Options (noSniff)
  if (isEnabled('noSniff')) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  // 3. Strict-Transport-Security (hsts)
  if (isEnabled('hsts')) {
    const val = options.hsts;
    if (val === undefined || val === true) {
      headers['Strict-Transport-Security'] = 'max-age=15552000; includeSubDomains';
    } else if (typeof val === 'object') {
      const maxAge = val.maxAge !== undefined ? val.maxAge : 15552000;
      const includeSubDomains = val.includeSubDomains !== false;
      const preload = !!val.preload;
      headers['Strict-Transport-Security'] = `max-age=${maxAge}${includeSubDomains ? '; includeSubDomains' : ''}${preload ? '; preload' : ''}`;
    }
  }

  // 4. X-Download-Options (downloadOptions)
  if (isEnabled('downloadOptions')) {
    headers['X-Download-Options'] = 'noopen';
  }

  // 5. X-Permitted-Cross-Domain-Policies (permittedCrossDomainPolicies)
  if (isEnabled('permittedCrossDomainPolicies')) {
    const val = options.permittedCrossDomainPolicies;
    if (val === undefined || val === true || val === 'none') {
      headers['X-Permitted-Cross-Domain-Policies'] = 'none';
    } else if (typeof val === 'string') {
      headers['X-Permitted-Cross-Domain-Policies'] = val;
    }
  }

  // 6. Referrer-Policy (referrerPolicy)
  if (isEnabled('referrerPolicy')) {
    const val = options.referrerPolicy;
    if (val === undefined || val === true || val === 'no-referrer') {
      headers['Referrer-Policy'] = 'no-referrer';
    } else if (typeof val === 'string') {
      headers['Referrer-Policy'] = val;
    }
  }

  // 7. X-XSS-Protection (xssFilter)
  if (isEnabled('xssFilter')) {
    headers['X-XSS-Protection'] = '0';
  }

  // 8. Content-Security-Policy (csp - Disabled by default)
  if (options.csp) {
    const val = options.csp;
    if (val === true) {
      headers['Content-Security-Policy'] = "default-src 'self'";
    } else if (typeof val === 'string') {
      headers['Content-Security-Policy'] = val;
    } else if (typeof val === 'object') {
      const parts: string[] = [];
      for (const [directive, sources] of Object.entries(val)) {
        if (Array.isArray(sources)) {
          parts.push(`${directive} ${sources.join(' ')}`);
        } else {
          parts.push(`${directive} ${sources}`);
        }
      }
      headers['Content-Security-Policy'] = parts.join('; ');
    }
  }

  // 9. Cross-Origin-Embedder-Policy (coep - Disabled by default)
  if (options.coep) {
    headers['Cross-Origin-Embedder-Policy'] = options.coep === true ? 'require-corp' : options.coep;
  }

  // 10. Cross-Origin-Opener-Policy (coop - Disabled by default)
  if (options.coop) {
    headers['Cross-Origin-Opener-Policy'] = options.coop === true ? 'same-origin' : options.coop;
  }

  // 11. Cross-Origin-Resource-Policy (corp - Disabled by default)
  if (options.corp) {
    headers['Cross-Origin-Resource-Policy'] = options.corp === true ? 'same-origin' : options.corp;
  }

  return headers;
}
