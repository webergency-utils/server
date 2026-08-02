# 0008 — SEO route groups and internal forward

- **Status:** Accepted
- **Date:** 2026-08-02
- **Deciders:** Webergency server maintainers

## Context

CMS / pretty-URL apps need to resolve a public path via application logic (often a DB lookup), then serve another endpoint’s response **without** a client `Location` redirect. Targets may be ordinary public routes or handlers that must never be reachable from the outside.

Industry analogues: Symfony `$this->forward`, Next.js / nginx internal rewrite, Express ordered routers with fallthrough. Nest `@Redirect` is a client redirect and is not this feature.

## Decision

1. **`@Seo` (paren-free)** marks endpoints for a high-priority **SEO router**. Incoming HTTP tries SEO first, then the public router. `@Internal` endpoints are excluded from both.
2. **SEO return contract:** handlers must return a **`SeoForward`** `{ method, path, query?, body? }` or `void` / `undefined`. Void falls through to the next SEO match (`Router.matchAll`), then public. Any other return is a 500.
3. **Forward target is rewrite-style:** HTTP verb + path. The hop looks up **public ∪ internal** only (SEO skipped) so rewrites cannot loop through SEO. Path params come from the router match; `query` is merged; `body` is shallow-merged into `@Body` after parse (`req.forwardBody`).
4. **`ServerResponse.forward(target)`** stashes the same descriptor on the response bag. After the handler returns, `RequestProcessor` detects `#pendingForward` (or a SEO `SeoForward` return) and throws a control-flow `ForwardIntent` that `Server` executes. Nested forwards are allowed (max 16 hops); repeating a `METHOD path` in the chain is a cycle → 500. No `Location` header. Combining `forward` with `redirect` / `stream` is rejected.
5. **`@Internal` (paren-free)** registers the endpoint’s path on an **internal router** only. Direct HTTP → 404; forward may target it. `@Seo` + `@Internal` on the same endpoint is a boot / AOT error. The same `(method, path)` on public and internal is a boot error. SEO and public may share a path (SEO wins externally).
6. **AOT:** `@Seo` methods must declare a return type compatible with `SeoForward | void` (including `Promise<…>` and unions); otherwise the transformer reports `INVALID_SIGNATURE`.

## Consequences

- **Positive:** SEO/CMS rows stay URL-centric; Internal handlers stay hidden; DI on SEO controllers unchanged; client never sees an internal redirect; multi-hop rewrites work with cycle safety.
- **Negative:** SEO handlers cannot render responses themselves; registry route keys are group-prefixed (`seo:` / `public:` / `internal:`).
- **Follow-ups:** Client 301 migration tables remain out of scope.

## References

- [0006 — ServerRequest / ServerResponse](./0006-server-request-response.md)
- Symfony `HttpKernel` forward / Next.js `rewrites`
