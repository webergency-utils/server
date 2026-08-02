# 0007 — Hierarchical `@File` uploads with streaming multipart

- **Status:** Accepted
- **Date:** 2026-08-01
- **Deciders:** Webergency server maintainers

## Context

ADR 0006 placed uploads on `ServerRequest.formData()` / `file()`, which buffers via the platform `FormData` parser. Large uploads need stream-to-disk (or custom sinks), hierarchical defaults, and a simple handler injection API.

## Decision

1. **In-tree streaming multipart parser** using a MultiBuffer (liqd-js style): append chunks without concatenating, boundary search with `partialIndexOf`, emit file parts as `UploadedFile` streams.
2. **Hierarchical `@File` config** merged Server → Module → Controller → Endpoint (`mergeFileConfigs`), same layering idea as Security.
3. **Dual `@File` surface:**
   - Class/method: `@File({ dest, maxFileSize, fields, onFile, storage })` and `@File('field', fieldOpts)`
   - Parameter: `@File('field')` → `UploadedFile`; `@Files()` → `UploadedFile[]`
4. **`@Body()` + multipart:** when Content-Type is `multipart/form-data`, server builds a query-shaped bag (`MultipartPayload.toObject()`): bracket names unflattened like urlencoded `QueryParser` (`profile[name]`, `docs[]`), values are strings + `UploadedFile` / `UploadedFile[]`. Then AOT **validator** with `from: 'query'`. JSON still uses `parser` (`from: 'json'`); urlencoded uses `parserQuery`.
5. **Storage DX:** `dest` / `filename` → disk during parse; `storage: 'memory'` (default without dest); `onFile` / `storage: 'manual'` for custom sinks (S3, etc.).
6. **`ServerRequest`:** keep buffered `formData()` / `file()`; add `multipart()` / `upload()` / `uploads()` / `payload()` for the streaming path.

`RequestReader.getBody` still rejects multipart with **415** (buffered path). Controllers use `@Body` → streaming bag + assert. Nested MIME (`multipart/*` part bodies) is re-parsed with a bracket prefix (`bundle[child]`) up to depth **3** (`MAX_MULTIPART_NEST_DEPTH`); deeper containers stay opaque strings/files.

## Consequences

- **Positive:** Large uploads without full buffering; DTO shape `{ title: string; documents: UploadedFile[] }` works like urlencoded forms; no typechecker `parse` change required for classes.
- **Negative:** Authors must not mix `formData()` and `multipart()` on the same request (body-once); import `UploadedFile` as a value (not `import type`) so AOT validators can `instanceof`.
- **Follow-ups:** First-class S3 storage helper.

## Related

- [0006](./0006-server-request-response.md) — facades; uploads extended here
- [0004](./0004-validation-from-modes.md) — `from: 'query'` / `json`
- [CONTEXT.md](../../CONTEXT.md) — UploadedFile, MultipartPayload, `@File`, `@Body`
