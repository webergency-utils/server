# 0004 — Typechecker `from` modes keyed by parameter source

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Webergency server maintainers
- **Updated:** 2026-08-18 — `parse` is wire text only (`typechecker` 0.8.0); adapters use raw URL query text
- **Updated:** 2026-08-18 — hierarchical `reviver` (JSON + query); `null` opts out

## Context

`@webergency-utils/typechecker` parsers (and legacy validators) accept a `from` channel that controls coercion: `json` keeps structured values as-is (a JSON string `"30"` stays a string), while `query` coerces strings to the declared TypeScript type and wraps singleton values into arrays when needed. Choosing the wrong channel either rejects valid form posts or silently accepts typed JSON that should have failed.

Parameter sources arrive as different wire shapes:

| Source | Wire shape |
| --- | --- |
| `@Body` with `application/json` or `application/*+json` | Structured JSON |
| `@Body` with `text/plain` | Decoded string (`charset` honored; default UTF-8) |
| `@Body` with `application/x-www-form-urlencoded` | Flat string map |
| `@Body` with `multipart/form-data` | Query-shaped bag → AOT **validator** with `from: 'query'` (`UploadedFile` via instanceof) |
| `@Query()` (no name) | Raw URL search text (no leading `?`) |
| `@Query('name')` | Single already-decoded scalar (or bag via assert) |
| `@Param` / `@Cookie` / `@Header` | Flat string entry |
| `@Headers` / `@Cookies` | Flat string map (whole bag) |
| Missing Content-Type | Sniffed: JSON first, then form-like urlencoded; otherwise 400 |

`Validation mode` (`strict` / `strip` / `relaxed`) is a separate axis and must not be conflated with `from`.

Wire bags on `ServerRequest` (`headers`, `cookies`, `query`, `params`) stay **strings**. Typed decorators must parse into a **new** value and must not mutate those bags.

## Decision

AOT `buildParser` bakes `from` into each generated parser:

- `@Query()` (whole bag) → parser with `from: 'query'` on **raw search text** (never starts with `?`)
- `@Query('name')` scalar → parser with `from: 'string'`; arrays/objects → **validator** with `from: 'query'`
- `@Param` / `@Cookie` / `@Header` → parser with `from: 'string'`
- `@Headers` / `@Cookies` → **validator** with `from: 'query'` (already-decoded maps; parse is string-only)
- `@Body` → two parsers: `parser` (`from: 'json'`) and `parserQuery` (`from: 'query'`)

At runtime `RequestProcessor.resolveParam` selects:

- `@Body` with effective Content-Type `multipart/form-data` → streaming bag (`toObject()`), then **validator** with `from: 'query'` (not `parser` / `parserQuery`)
- `@Body` with effective Content-Type `application/x-www-form-urlencoded` → raw text → `parserQuery || parser` (optional `reviver`)
- `@Body` JSON → raw text → `parser` (optional `reviver`: Endpoint `@Reviver` → Module.reviver → ServerOptions.reviver)
- `@Query()` with a parser → `req.queryString` (raw search, plus forwarded keys) → parser (same `reviver`)
- `@Query()` without a parser → `req.query` bag (SEO forward / untyped handlers)
- otherwise named scalars → decoder string → parser
- `@Body` when `req._json` is already set (RPC / pre-parsed) → **validator** (`from: 'json'`), not `parse`

Effective Content-Type comes from `getEffectiveBodyContentType` in `helpers/request-reader.ts`: declared header, else sniff. Unsupported types yield **415** before parsing runs (`RequestReader.getBody` still 415s multipart; `@Body` uses the streaming path instead).

Hand-written tests that still attach a `validator` function keep the legacy path: `ctx.from` is set the same way (`query` for Query/Param/Cookie/Header/Headers/Cookies/urlencoded Body, else `json`).

Typed `@Query()` uses raw search text so `parse` never sees a bag. Untyped `@Query()` still receives the `parseQueryString` bag (including keys injected by SEO forward). `Headers` / `Cookies` stay on assert. `ServerRequest.query` is still a bag for handlers that read it directly. Adapters (Node / Bun / Deno, including WS upgrade) take query text from the raw URL, not `URLSearchParams`. Parse errors are reported under the parameter source (`body.age`, `id`).

## Consequences

- **Positive:** Form posts, query strings, cookies, and headers coerce predictably; JSON bodies keep type fidelity; 415 surfaces protocol mistakes early; AOT parsers avoid per-request `from` switching; request facades keep stable string bags.
- **Negative:** Authors must understand two axes (`from` vs validation mode); a handler typed `age: number` accepts `"30"` from a query/cookie/header but rejects `"30"` from JSON.
- **Follow-ups:** Keep README coercion table and CONTEXT glossary aligned whenever a new parameter source is added.

## Related

- [CONTEXT.md](../../CONTEXT.md) — from, Validation mode, ServerRequest
- [0006](./0006-server-request-response.md) — ServerRequest / ServerResponse
- README — “Body `from` modes”, parameter decorator docs
- `@webergency-utils/typechecker` — coercion / parse implementation
