# 0006 — Sealed `ServerRequest` / `ServerResponse` wrappers

- **Status:** Accepted
- **Date:** 2026-08-01
- **Deciders:** Webergency server maintainers

## Context

Adapters speak Web Standard Fetch `Request` / `Response` (or bridge to them on Node). Exporting that shape to controllers leaked runtime details, encouraged ad-hoc `req.formData()` without `maxBodySize`, and pushed authors toward either Fetch types or a long list of one-off param decorators.

We still want typed param decorators where AOT validation applies, plus convenience decorators for single values (`@Ip`, `@Peer`, …), without forcing every handler to take a request object.

## Decision

Introduce sealed **`ServerRequest`** and **`ServerResponse`** classes injected by `@Request` / `@Response`:

- Not Fetch, Node `IncomingMessage`, or Bun/Deno natives — no public `.raw` / cast hatch.
- Same TypeScript surface on every adapter.
- Fetch remains the adapter ↔ pipeline contract.

**Typechecked decorators** (AOT parsers): `@Body` / `@Payload`, `@Query`, `@Param`, `@Cookie`, `@Header`, `@Headers`, `@Cookies`.

**Convenience decorators** (no AOT typecheck): `@Ip`, `@Peer`, `@Url`, `@Hostname`, `@Path`, `@RawBody`, `@Context`, etc. — kept so one- or two-value handlers need not take `@Request`.

**Dual access:** `ServerRequest` exposes string bags (`headers`, `cookies`, `query`, `params`) and helpers (`file`, `formData`, `stream`, …). Typed decorators that coerce must return **new** values and must not mutate those bags.

**Buffered uploads / streams** live on `ServerRequest` (`formData` / `file` / `files` / `stream` / `rawBody` / `text`). Buffered body reads honor `maxBodySize`.

**Streaming uploads** are specified in [0007](./0007-file-uploads-multipart.md): hierarchical `@File` / `@Files`, in-tree MultiBuffer multipart parser, `ServerRequest.multipart()` / `upload()` / `uploads()`.

**`ServerResponse`** evolves the former `ResponseBag` with `setHeader`, `setCookie`, `clearCookie`, and `redirect`. Handler return values still supply the body; `ArrayBuffer` / typed arrays / `Blob` / `ReadableStream` are returned as binary/stream responses (not `JSON.stringify`).

`EndpointRequest` / `EndpointResponse` alias the wrappers. `ResponseBag` remains an alias of `ServerResponse` for compatibility.

## Consequences

- **Positive:** Controllers stay adapter-agnostic; uploads get a capped API; param surface stays usable without request injection; validation cannot corrupt wire string bags.
- **Negative:** Authors must learn wrapper vs decorator dual access; middleware typed as `EndpointRequest` now receives `ServerRequest` (string header map, not Fetch `Headers`).
- **Follow-ups:** Optional client-disconnect abort on `signal` (streaming multipart: see 0007).

## Related

- [CONTEXT.md](../../CONTEXT.md) — ServerRequest, ServerResponse
- [0004](./0004-validation-from-modes.md) — `from` channels for Header(s) / Cookie(s)
- [0007](./0007-file-uploads-multipart.md) — `@File` / streaming multipart
- README — parameter decorators, uploads
