# Testing Knowledge Base & Conventions

This document tracks observed rules, anti-patterns, and project-specific testing preferences to maintain high code quality and test resiliency across the `@webergency-utils/server` package.

## Rules

- **Exhaustive Branch Coverage:** Every execution path (conditional statement, default value fallback, error catch block) must be explicitly targeted by a named test.
- **Strict Isolation:** Ensure zero shared state between tests. Use `beforeEach` to instantiate fresh objects and `vi.clearAllMocks()` or `vi.resetAllMocks()` where appropriate.
- **Visual AAA structure:** Structure test cases clearly using Arrange, Act, and Assert comments separated by vertical whitespace.
- **Test Observable Behavior:** Focus on testing the public boundaries and interface behavior instead of private internals.
- **Content-Type normalization:** When asserting body parse / `from` selection, cover charset parameters (`application/json; charset=utf-8`) so mime stripping stays covered.

## Anti-Patterns

- **Mutating Shared State:** Avoid declaring variables at the module level in tests that get mutated within `it` blocks without being reset in `beforeEach`.
- **Accidental Coverage:** Do not count code paths executed as a side-effect of other tests as proper unit tests for those code paths. Each specific behavior should have dedicated assertions.
- **Using `any` for Mocks:** Prefer `unknown` or typed mocked helpers (e.g. `vi.fn()` properly typed) to preserve TypeScript compilation guarantees.

## Mocking Conventions

- **Simple Mocking:** Use `vi.fn()` for mock callbacks and functions.
- **External Interfaces/Complex Objects:** When mocking complex classes, mock their interface rather than inheriting or instantiating them directly.
- **AugmentedRequest fakes:** Prefer a thin typed fake (`headers.get`, `arrayBuffer`, `params`, `query`) cast via `as unknown as AugmentedRequest` over going through `Server` when unit-testing `RequestReader` / `RequestProcessor.resolveParam`.
- **Validator `from` assertions:** Spy on the validator and read `ctx.from` / `ctx.mode` inside the spy; assert the outer ctx is restored after `resolveParam` returns.
- **Prefer real helpers:** Use real `parseQueryString`, `parseSize`, and `@webergency-utils/typechecker` validators at the boundary unless the seam under test is specifically those helpers.
- **Runtime adapters:** Node CI runs the full Vitest suite. Bun CI runs Vitest (Node-only mocked adapter tests are `it.skipIf`) plus `scripts/runtime-suite.mjs`. Deno CI runs the same listen suite (validation + HTTP + SSE + WebSocket over the native adapter). Keep `scripts/runtime-smoke.mjs` for a minimal hello/ws probe. Do not rely on mocked Bun/Deno blocks in `server.test.ts` for real adapter coverage.
- **Coverage denominator:** Exclude build hosts (`compiler/cli.ts`, `compiler/register.ts`, `compiler/ts.ts`) and the deprecated `core/metadata.ts` shim. Under Node, also exclude `bun-adapter` / `deno-adapter` (attributed via `unit-bun` / `runtime-deno` Codecov uploads). Runtime Node coverage is scoped to the bundled `dist/index.js` so it does not inflate the project denominator. Fuzz sources live under `fuzz/` (outside coverage).
- **Immutable security headers:** To hit `applySecurityHeaders` catch in `server.ts`, use `security: true` without `cors`. CORS + Origin rebuilds the Response first and can mask the security catch.
- **JSON / query reviver:** `ServerOptions.reviver` is copied to `AugmentedRequest.globalReviver` after the Router match. `RequestProcessor.applyReviver` resolves Endpoint → Module → Server (`undefined` inherits, `null` opts out) onto `req.reviver`. Module meta is read from the registry bag's `moduleClass` (`getModuleMeta`), not `instance.constructor`. Typed `parse` gets `{ reviver }` for JSON body, urlencoded body, and `@Query()`. Untyped JSON is `parse<any>`-shaped (`JSON.parse` then typechecker `reviveTree`). Untyped urlencoded is the same shape via `parseQueryString` then `reviveTree`. `@Reviver` requires `(fn)` or `(null)` — bare / empty is a compile error. Wire bags (`req.query`) stay strings.
- **parse is wire text:** `resolveParam` passes strings into typechecker `parse` (JSON body text, urlencoded text, `req.queryString`). Objects (multipart, header/cookie maps, named query arrays, `forwardBody` merges, RPC `_json`) use assert. Adapters parse query via raw URL + typechecker `parseQueryString`, not `URLSearchParams`. Parse errors are prefixed with the parameter source (`body.age`).
- **Error JSON:** Client bodies go through `clientErrorBody` (merge `message` + `data`, drop `stack`, drop `debug` on 5xx, redact `password` / `confirmPassword`). Logs use `errorLogFields` so operators still get `stack`. Do not put `stack` on `err.data` in fixtures unless the test is about stripping it.
- **Server error logs:** Handler throws are swallowed by `RequestProcessor.execute`; spy `RequestProcessor.execute` → `mockRejectedValue` to exercise `Server` catch logging (`logs: true`).
- **node-adapter TLS/SNI:** Mock `https` + `node:tls` via `vi.hoisted` + `vi.mock` in `node-adapter.test.ts` only (never in `server.test.ts`, which already mocks http/https for start()). Prefer `vi.mock` over `vi.spyOn` for ESM exports like `createSecureContext`.
- **WS heartbeat tests:** Do not spy `clearTimeout` under fake timers (breaks clearing). Drive pong via `conn.emitter.emit('pong')` when asserting timeout cancellation.
- **Bootstrap module hosts:** Prefer `setModuleMeta` / `setControllerMeta` / `defineController` over runtime decorators. Module meta may include `guards` / `interceptors` so ingest maps them onto the module instance (same as top-level `options.guards`).
- **TCP microservice edges:** Cover adapter/client branches with ephemeral `net` servers (`listen(0)`), not the shared AOT integration port. Mock `MicroserviceAdapter.listen` when testing `Microservice` handler branches (unknown pattern, EventPattern throw → `MicroserviceNoReply`, MessagePattern Error without `.data`).
- **RequestProcessor + registry:** Drive `execute` / `executeWs` / `runWs` / `executeRpc` via `ApplicationRegistry` + `runWithRegistry`; register controllers/guards/interceptors/providers on the registry (not a full `Server`) for unit coverage.
- **Return serializers:** AOT attaches `returnTypeSerializer` for every non-void/non-Response/non-never/non-WS return — including root `any` / `unknown` / SSE `any` payloads (`serializeAny`). At runtime, when a serializer is present it is always used (primitives and objects), not only for object results.
- **SSE ReadableStream branch:** Node `ReadableStream` is also async-iterable, so `execute` prefers the async-iterator SSE path. To hit the `instanceof ReadableStream` body passthrough, clear `Symbol.asyncIterator` on the stream in the test.
- **Missing middleware (falsy instance):** `DIContainer.resolve` throws for unregistered tokens; to hit the `Middleware ${name} not registered` check, register `{ value: null }` so `getInjectable` returns falsy.
- **Transformer plugin coverage:** Drive edges through `compileAndTransform` in `plugin.test.ts` — bare `@Cors`/`@Security`, `@Cors(null)` / `{ origin: undefined }`, `@Inject()` throw, property/ctor/param Inject variants, class-level `Unuse`/`Override*`, guard declared after controller (params re-scan), post-class binding patterns + `__val_*` for `findInsertionIndex`.
- **webergency-tsc rootDir:** Infer `src` only when `rootDir` is omitted and every input lives under `src/`. An explicit `rootDir` (including `"."` → `dist/src`) is left alone because apps may key `__dirname` asset paths off that layout.
- **E2E HTTP parse:** `tests/e2e/http-parse.test.ts` compiles `tests/e2e/fixture` with the webergency-tsc emit pipeline (`createBeforeTransformers`), `listen()`s a real port, and drives query/body/header/cookie/methods/guards/CORS/SSE with `fetch`. Optional named `@Query` / `@Header` (`apiKey?: string`) must skip parse when the key is missing — generated `from:'string'` parsers call `expectString` before the `undefined` union arm. Paren-free param decorators are `@Cookies` / `@Headers` / `@RawBody` / `@Public` (not `()`). `@RawBody` is `ArrayBuffer`.
- **match negate (713-718):** `pathToRE('/:a-ab:b')` and `pathToRE('/:a-ab:b', { delimiter: '::' })`.
- **Swagger `$defs`:** circular interfaces (e.g. `TreeNode { child?: TreeNode }`) make `buildJsonSchema` emit `$defs` so `registerSchema` merges into `components.schemas`.
- **client-ip mapped v6:** hex-form `0:0:0:0:0:ffff:a01:203` is not collapsed by `normalizeIp`, so it exercises the v6-vs-v4 CIDR branch.
- **maxBodySize streaming:** When asserting early reject without buffering, set `streamBody` (ReadableStream) on the request fake and omit Content-Length so `getRawBody` takes the `getReader` path instead of `arrayBuffer()`.
- **RateLimiter eviction:** Expired keys are swept every 64 ops (or at size ≥ 1024). Drive eviction with fake timers + enough `checkLimit` calls; assert via `(limiter as any).rateLimitStore`.
- **TCP line caps:** `TCP_MAX_LINE_BYTES` (1 MiB) applies to incomplete buffers and complete lines; oversized peers are destroyed (adapter) or pending RPCs rejected (client).
