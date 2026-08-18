# @webergency-utils/server

A high-performance, industrial-grade web server with compile-time type validation for the modern JavaScript ecosystem. Built on a zero-reflection model: route metadata and validators are generated ahead of time, so startup stays fast and the runtime stays lean across Node.js, Bun, and Deno.

[![npm version](https://img.shields.io/npm/v/%40webergency-utils%2Fserver)](https://www.npmjs.com/package/@webergency-utils/server)
[![License](https://img.shields.io/npm/l/%40webergency-utils%2Fserver)](https://www.npmjs.com/package/@webergency-utils/server)
[![Maintenance](https://img.shields.io/badge/maintenance-active-brightgreen.svg)](#maintenance)
[![dependencies](https://img.shields.io/badge/dependencies-1-brightgreen.svg)](https://www.npmjs.com/package/@webergency-utils/server?activeTab=dependencies)
[![npm downloads](https://img.shields.io/npm/dm/%40webergency-utils%2Fserver)](https://www.npmjs.com/package/@webergency-utils/server)
<br>
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/webergency-utils/server/badge)](https://securityscorecards.dev/viewer/?uri=github.com/webergency-utils/server)
[![codecov](https://codecov.io/gh/webergency-utils/server/branch/main/graph/badge.svg)](https://codecov.io/gh/webergency-utils/server)
[![tests](https://github.com/webergency-utils/server/actions/workflows/ci.yml/badge.svg)](https://github.com/webergency-utils/server/actions/workflows/ci.yml)
[![CodeQL](https://github.com/webergency-utils/server/actions/workflows/codeql.yml/badge.svg)](https://github.com/webergency-utils/server/actions/workflows/codeql.yml)

## TL;DR

```typescript
import { Controller, Get, Post, Body, Param, Server } from '@webergency-utils/server';

interface User {
  id: string;
  name: string;
}

@Controller('/users')
export class UserController {
  @Get('/:id')
  getUser(@Param('id') id: string) {
    return { id, name: 'Alice' };
  }

  @Post()
  createUser(@Body('strip') user: User) {
    return user;
  }
}

const server = new Server({
  port: 3000,
  controllers: [UserController]
});

await server.start();
```

Controllers must be compiled with `webergency-tsc` (or the transformer / `register` host) so `Symbol.for` route meta exists before `start()`.

## Installation & Setup

```bash
npm install @webergency-utils/server
npm install -D typescript
```

**Runtime dependency:** `@webergency-utils/typechecker` (validators; pulled in automatically).  
**Peer dependency:** `typescript` `^5 || ^6` (compiler API for the AOT transformer / CLI).  
**Engines:** Node.js `>=22` (Bun and Deno are also supported via native adapters).

### AOT compile (required)

Decorators are compile-time markers. The transformer writes `Symbol.for(...)` metadata and inlined validators onto each class in the emitted JS — there is no sidecar manifest and no process-global metadata store. Validators come from `import * as __tcRuntime from '@webergency-utils/typechecker/runtime'`.

Compile with the package CLI (drop-in `tsc` wrapper):

```bash
npx webergency-tsc -p tsconfig.json
```

Or register the transformer via [ts-patch](https://github.com/nonara/ts-patch) / your existing TS plugin host:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "experimentalDecorators": true,
    "plugins": [
      { "transform": "@webergency-utils/server/transformer" }
    ]
  }
}
```

For local TypeScript without a prior `dist` emit:

```bash
node --import @webergency-utils/server/register ./src/main.ts
```

`Server({ module })` / `Server({ controllers, providers, guards, interceptors })` walks the graph on first `start()` or `fetch()` and fails fast if a declared controller host has no AOT meta.

**Library packages:** compile with `webergency-tsc` (or the transformer). Do not re-bundle with tsup/esbuild in a way that strips `Symbol.for(...)` or `__injections__`. Guard `@Header` / `@Request` AOT lives on the guard class (`webergency.server.guard`); apps only need `@Protect(LibGuard)` plus their own webergency-tsc emit. See [ADR 0009](docs/adr/0009-portable-host-aot.md).

This package’s `npm run build` is `webergency-tsc` (ESM + `.d.ts`) then tsup CJS with treeshake/minify off. `prepublishOnly` runs that build before `npm publish`.

Entry points:

| Export | Purpose |
| --- | --- |
| `@webergency-utils/server` | Runtime API |
| `@webergency-utils/server/transformer` | AOT compiler plugin |
| `@webergency-utils/server/register` | Optional load-time AOT host |

## Architecture & Internals

1. **AOT transformer / `webergency-tsc`** — Analyzes controllers at build time; emits `Symbol.for` meta + typechecker validators into each file’s JS. Decorators are no-ops without that emit.
2. **Per-Server registry** — `ApplicationRegistry` is owned by each `Server` / `Microservice`. Bootstrap walks modules/controllers lazily on first `start()`/`fetch()`. Active registry is available to the request/DI stack via `getRegistry()` / `runWithRegistry()`.
3. **Adapters** — Maps Web Standard `Request` / `Response` to `Bun.serve`, `Deno.serve`, or Node `http`/`https` (Node 22+). Runtime is auto-detected.
4. **Pipeline** — Match route → security checks → middlewares → guards → interceptors → handler → response merge (`ServerResponse` headers/status).
5. **Routing** — Exact paths resolve through a per-method map with no regex. Pattern routes are bucketed per method and tried most-specific first, so `/users/me` beats `/users/:id` and `/files/:name` beats `/files/*rest` no matter what order they were registered in. Registration order only breaks ties between equally specific patterns, and a pattern that can never be reached (e.g. a second `/u/:key` after `/u/:id`) is warned about at bootstrap. A request whose path matches only under other verbs gets **405** with `Allow`; an unknown path is still 404. A WebSocket upgrade to a non-WS path stays 404, since WS is a transport rather than an advertised method. **SEO / Internal:** `@Seo` endpoints form a high-priority group tried before public routes; they return `{ method, path, query?, body? }` or void (fallthrough). `@Internal` paths are forward-only (direct HTTP → 404). `ServerResponse.forward` / SEO returns re-dispatch on public ∪ internal (SEO skipped; nested hops allowed, cycles rejected). See `docs/adr/0008-seo-internal-dispatch.md`.
6. **OPTIONS** — Genuine CORS preflight is answered by the framework before guards, using the target route's own `@Cors` config. A plain `OPTIONS` request routes normally to `@Options` / `@All`, or gets `204` + `Allow`. Asterisk-form `OPTIONS *` reports server-wide `Allow` without routing.
7. **Body `from` modes** — `parse` is **wire text only**. JSON / `application/*+json` → `parser` (`from: 'json'`) on the raw body string. urlencoded → `parserQuery` (`from: 'query'`) on the raw form string. Whole `@Query()` → raw URL search (no `?`). Named `@Query` / `@Param` / `@Header` / `@Cookie` scalars → `from: 'string'`. `@Headers` / `@Cookies` / multipart / named query arrays → **assert** with `from: 'query'`. `text/plain` is the raw string (charset-aware). Missing Content-Type: sniff JSON then form-like urlencoded; other types → **415**. Optional `reviver` (Server / Module / `@Reviver`) is passed into `parse` for JSON and query; untyped JSON / urlencoded apply it too.
8. **TLS** — Basic `cert`/`key` uses the native adapter on Bun/Deno. `requestCert` / `sniCallback` (mTLS / SNI) use Node `https` on all runtimes so `@Peer` works.
9. **Request ID** — Every request accepts or generates `X-Request-Id`, exposes it on `RequestContext` / `LogContext`, and echoes it on the response.
10. **Health** — Optional `health` probes answer before routing: liveness while the process can answer, readiness only when bootstrapped, listening, and not shutting down. OpenTelemetry is left to consumer interceptors / `Server` events — see `docs/adr/0005-observability.md`.
11. **ServerRequest / ServerResponse** — Sealed facades injected by `@Request` / `@Response` (and middleware). Not Fetch types. Buffered uploads via `req.formData()` / `req.file()`; streaming multipart via `@File` / `req.multipart()` / `req.upload()` (MultiBuffer parser). See `docs/adr/0006-server-request-response.md` and `docs/adr/0007-file-uploads-multipart.md`.

**Dependencies:** `@webergency-utils/typechecker` supplies runtime validators referenced by AOT-emitted code. Peer `typescript` (`^5 || ^6`) is required for `webergency-tsc`, the transformer plugin, and `register`. Dual package: ESM (`.js`) and CommonJS (`.cjs`) via conditional `exports`.

## Glossary

* **Controller** — Decorated class grouping HTTP/WS/SSE/RPC endpoints.
* **Endpoint** — Handler mapped to a verb + path (or RPC pattern).
* **Validation mode** — `strict` | `strip` | `relaxed` for body/query/response shaping.
* **`from`** — Typechecker coercion mode (`json` vs `query`) chosen from the parameter source / Content-Type.
* **ServerRequest** — Sealed request facade (`@Request` / middleware); string bags + body helpers. Not Fetch `Request`.
* **ServerResponse** — Mutable headers/status bag (`@Response` / middleware); chainable `status` / `header` / `headers` / `cookie` / `redirect` / `forward`. Not Fetch `Response`. (`ResponseBag` is a deprecated alias.)
* **SeoForward / `@Seo` / `@Internal` / forward** — SEO-first route group, rewrite descriptor, forward-only endpoints, and one-hop internal re-dispatch (no `Location`). See ADR 0008.
* **Guard / Interceptor / Middleware** — Auth gate, wrap-around handler, and pre-handler hooks.
* **Adapter** — Runtime bridge (`Node` / `Bun` / `Deno`) under `Server`.
* **ApplicationRegistry** — Per-instance route/DI registry filled from `Symbol.for` meta at bootstrap.
* **`webergency-tsc`** — CLI that runs `tsc` with the Webergency AOT transformer.

## API Reference

### `Server`

Orchestrates routing, adapters, security, and lifecycle.

#### `new Server(options: ServerOptions)`

| Option | Type | Description |
| --- | --- | --- |
| `port` | `number` | Listen port |
| `controllers?` | `any[]` | Controller classes to register (must have AOT Symbol meta) |
| `providers?` | `any[]` | Flat providers when not using `module` |
| `guards?` / `interceptors?` | `any[]` | Flat guards / interceptors when not using `module` |
| `module?` | `any \| any[]` | Application module(s) |
| `cors?` | `CorsOptions` | Global CORS |
| `security?` | `SecurityOptions \| boolean` | Global security / headers. `maxBodySize` defaults to `1mb`; set `0` (or `security: false`) for no cap |
| `responseMode?` | `'strict' \| 'relaxed' \| 'strip'` | Default response validation mode |
| `tls?` | `TlsOptions` | TLS / mTLS |
| `headersTimeout?` | `number` | Node only: time to receive complete headers (default `60000`) |
| `requestTimeout?` | `number` | Node only: time for the entire request (default `300000`) |
| `keepAliveTimeout?` | `number` | Node only: idle keep-alive socket timeout (default `5000`) |
| `health?` | `boolean \| { path?, readyPath? }` | Optional `GET /health` (live) and `GET /ready` (ready) probes |
| `trustProxy?` | `string[]` | Peer CIDR allowlist for XFF; omit/`[]` = never trust. Use `TRUST_PROXY_LOOPBACK` for local loopback peers. |
| `reviver?` | `Reviver \| null` | JSON.parse-style reviver for typed JSON / query `parse` and untyped JSON / urlencoded bodies. Overridden by Module.reviver and `@Reviver`. `null` opts out. |
| `logger?` / `logs?` | `Logger` / `boolean` | Logging |
| `shutdownTimeout?` | `number` | Graceful shutdown wait |

**Methods:** `start()`, `shutdown()`, `fetch(request)` (in-process), `ensureReady()`, `getBody` / `getRawBody`, `on` / `off` for `start` | `beforeShutdown` | `shutdown` | `request` | `error`.  
**Property:** `registry` — the owning `ApplicationRegistry`.

```typescript
const server = new Server({ port: 3000, controllers: [UserController] });
await server.start();
await server.shutdown();
```

#### CORS defaults (`CorsOptions`)

* `allowedHeaders` is **deny-by-default**. When unset, a preflight only allows `Accept`, `Accept-Language`, `Content-Language`, `Content-Type`, and `Authorization`; anything else in `Access-Control-Request-Headers` is dropped instead of echoed back. Set `allowedHeaders` to replace that list.
* A preflight whose `Origin` is not allowed gets **403**, not a 204 that looks successful.
* Reflected (non-`*`) origins add `Vary: Origin`.

#### Security header defaults (`SecurityOptions`)

`security: true` (or any object) emits `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Download-Options`, `X-Permitted-Cross-Domain-Policies`, `Referrer-Policy`, and `X-XSS-Protection: 0`. Off unless configured: `csp`, `coep`, `coop`, `corp`, `permissionsPolicy`.

* `permissionsPolicy` — `true` sends `camera=(), microphone=(), geolocation=()`; a string is used verbatim; an object maps features to allowlists, e.g. `{ camera: [], geolocation: ["'self'"] }` → `camera=(), geolocation=('self')`.
* `referrerPolicy` and `permittedCrossDomainPolicies` accept only their RFC-defined tokens. An unrecognized value is dropped rather than emitted as a malformed header.
* `rateLimit` — `{ max, window?, strategy? }`. `window` accepts `'30s'` / `'5m'` / `'1h'` or milliseconds (default `1m`). `strategy: 'fixed'` (default) allows up to 2x `max` across a window boundary; `'sliding'` weights the previous window to smooth that. A rejection returns 429 with `Retry-After`. The limiter is in-memory and per-process — not distributed — and tracks at most 10 000 `path:ip` keys, evicting least-recently-used ones beyond that.

### Microservices

#### `Microservice` + `TcpMessageAdapter` + `TcpClient`

TCP JSON-lines microservice protocol (`MessagePattern` request/response, `EventPattern` fire-and-forget). Same AOT bootstrap as `Server`: pass `module` and/or flat `controllers` / `providers` / `guards` / `interceptors`.

| Decorator | Client | Behavior |
| --- | --- | --- |
| `@MessagePattern(pattern)` | `TcpClient.send` | Request/response (`id` correlation) |
| `@EventPattern(pattern)` | `TcpClient.emit` | Fire-and-forget (no reply; errors logged) |

```typescript
import {
  Microservice, TcpMessageAdapter, TcpClient,
  Controller, MessagePattern, EventPattern, Payload
} from '@webergency-utils/server';

@Controller()
class MathService {
  @MessagePattern('math.sum')
  sum(@Payload() data: { a: number; b: number }) {
    return data.a + data.b;
  }

  @EventPattern('logs.notify')
  notify(@Payload() msg: string) {
    console.log(msg);
  }
}

const ms = new Microservice(new TcpMessageAdapter(3999), {
  controllers: [MathService]
});
await ms.start();

const client = new TcpClient({ port: 3999 });
await client.connect();
await client.send('math.sum', { a: 1, b: 2 }); // → 3
await client.emit('logs.notify', 'booted');
await ms.shutdown();
```

**Constructor:** `new Microservice(adapter, options?)` — `options` mirrors flat/`module` bootstrap fields on `ServerOptions`.  
**Property:** `registry`. **Methods:** `ensureReady()`, `start()`, `shutdown()`.  
`MicroserviceNoReply` — sentinel returned for `@EventPattern` so adapters never write a reply envelope.

### Route decorators

* `@Controller(prefixOrOptions?)` — Base path / controller options.
* `@Get` / `@Post` / `@Put` / `@Delete` / `@Patch` / `@Head` / `@All` — HTTP verbs (`path` default `''`).
* `@Options(path?)` — Non-preflight `OPTIONS` only. A genuine CORS preflight (both `Origin` and `Access-Control-Request-Method` present) is always answered by the framework **before guards run**, so it never reaches your handler — browsers omit credentials on preflight, and dispatching it into a `@Protect`ed route would reject it and break CORS. When no `@Options` route matches, the framework answers `204` with `Allow`.
* `@Ws(path?, options?)` — WebSocket channel (`WsOptions`: `maxPayload?`, `pingInterval?`, `pingTimeout?`). On Node the frame reader enforces RFC 6455: unmasked client frames, non-zero RSV bits, unknown opcodes, oversized or fragmented control frames, bad close codes, and invalid UTF-8 all close the connection. Fragmented messages are reassembled, and `maxPayload` applies to the assembled message.
* `@Sse(path?)` — Server-Sent Events. Yield `{ event?, id?, retry?, data }` or a bare payload. Declared return types validate **each chunk’s `data`** (or the whole chunk); `strict` / `strip` / `relaxed` apply; failure aborts the stream after headers are sent.
* `@MessagePattern(pattern)` / `@EventPattern(pattern)` — TCP microservice patterns.
* `@Cors(config?)` / `@Security(config?)` — Per-route CORS / security.
* `@Reviver(fn | null)` — JSON.parse-style reviver for JSON and query parse. Requires an argument (`fn` or `null`). Class/method override of `ServerOptions.reviver` / `Module.reviver`. `null` opts out of every parent. Nearest defined wins (Endpoint → Controller → Module → Server).
* `@ResponseMode(mode)` — Per-handler response validation mode.
* `@Protect` / `@OverrideProtect` / `@Unprotect` — Guards.
* `@Intercept` / `@OverrideIntercept` / `@Unintercept` — Interceptors.
* `@Use` / `@OverrideUse` / `@Unuse` — Middlewares.
* `@Public` — Marks route/class public (framework-specific bypass metadata).
* `@Seo` — Paren-free; high-priority SEO route group (return `SeoForward` or void).
* `@Internal` — Paren-free; forward-only (not externally routable).
* `@Meta(...)` / `@SetMetadata(key, value)` — Arbitrary metadata for `Reflector`.
* `@Injectable(options?)` / `@Inject(token?)` / `@Module(metadata)` / `@Global()` — DI. `@Module` may set `files` and `reviver` defaults for its controllers.
* Lifecycle interfaces: `OnInit`, `OnDestroy`.

### Dependency injection notes

* **Full catalog:** see [INSTANTIATION.md](./INSTANTIATION.md) for every provider shape (`value` / `class` / `factory`, injecting instances, scopes, injection sites) and a ranked list of recommended approaches.
* **Tokens are module-scoped.** A provider is reachable from another module only if the owning module exports it. Two modules claiming the same token is a bootstrap error, as is two module classes sharing a name (modules are identified by class name).
* **Resolution is memoized.** Each `(token, module)` pair caches its provider, declaring module, dependency list, and resolved scope, and instances are keyed by `(token, module)` so same-named tokens in different modules cannot collide. Registering a provider invalidates the cache, so late registration still works.
* **Scope is inherited.** A provider becomes request-scoped as soon as anything it depends on is.
* **Circular dependencies** resolve through a lazy proxy and are logged at bootstrap as `A -> B -> A`. A request scope declared inside a cycle cannot be detected, which is why the cycle is reported.
* **Lifecycle order.** `onInit` runs automatically during `resolve` / `resolveAll` (dependency-first, awaited). `onDestroy` runs for every instance: request-scoped and in-request transients at request end; singletons and out-of-request transients via `registry.destroyAll()` on shutdown (dependents first).

### Parameter decorators

**No parentheses** (parameter index metadata): `@Request`, `@Context`, `@Response`, `@Headers`, `@Ip`, `@Url`, `@Hostname`, `@Path`, `@RawBody`, `@Peer`, `@Cookies`, `@Payload` (RPC body alias).

**With arguments:**

* `@Body(mode?)` — Parsed body. Modes: `strict` | `strip` | `relaxed`. JSON → `parser` (`from: 'json'`); `text/plain` → string; urlencoded → `parserQuery` (`from: 'query'`); **`multipart/form-data` → bag + AOT validator (`from: 'query'`)** so DTOs like `{ title: string; documents: UploadedFile[] }` coerce strings and keep file instances. Missing CT sniffs JSON then form; unsupported CT → **415**; bad JSON → **400**.
* `@File` / `@Files` — Streaming multipart uploads. Class/method `@File({ dest, maxFileSize, onFile, fields })` configures handling (merged ServerOptions.files → Module.files → controller → endpoint). Parameter `@File('field')` injects `UploadedFile`; `@Files()` injects all files. Prefer `dest` for temp/disk paths, or `onFile` for custom sinks (e.g. S3). For the full form bag use `@Body()` with multipart Content-Type.
* `@Query(name?, mode?)` — No name + typed: raw URL search text → `parse` `from: 'query'`. No name + untyped: `req.query` bag. Named scalar → `from: 'string'`. Named array/object → assert `from: 'query'`.
* `@Param(name)` / `@Header(name)` / `@Cookie(name)` — Path / header / cookie scalar (`from: 'string'`).
* `@Headers` / `@Cookies` — Whole string maps, AOT-**asserted** against the parameter type (`from: 'query'`). `parse` is not used (not wire text).
* `@ConnectedSocket()` — WebSocket instance for `@Ws`.

`@Request` injects **`ServerRequest`** (sealed; not Fetch). Convenience fields mirror `@Ip` / `@Peer` / …; buffered body helpers honor `maxBodySize`. Streaming uploads: `req.multipart()` / `req.upload(name)` / `req.uploads()` / `req.payload()`.

`@Response` injects **`ServerResponse`** (same as middleware). Chainable: `status(code, statusText?)`, `header(name, value)`, `headers({ ... })`, `cookie(name, value?, options?)`, `stream(body)`, `redirect(code, url)`, `forward({ method, path, query?, body? })`. Empty/`null`/`undefined` cookie values clear the cookie. Returning a plain value still supplies the body (JSON / binary). **Returning a Node `Readable` / `fs.ReadStream` or Web `ReadableStream`** pipes bytes to the client with backpressure (not loaded fully into memory). **Returning the `ServerResponse` itself** means the handler owns the response — the framework finalizes with that facade’s status, headers, and optional `stream()` body and does not JSON-serialize the return value. **`forward`** stashes an internal rewrite (no `Location`); after the handler returns, the framework re-dispatches to that `method`+`path` on public/`@Internal` routes. Nested forwards are allowed (max 16 hops); cycles are rejected.

```ts
import { createReadStream } from 'node:fs';

@Get('/file')
download() {
  return createReadStream('/path/to/large.bin'); // piped, not buffered
}

@Get('/file-owned')
owned(@Response() res: ServerResponse) {
  return res
    .header('Content-Type', 'application/pdf')
    .stream(createReadStream('/path/to/doc.pdf'));
}
```

#### SEO / Internal quick start

```ts
import { Controller, Get, Param, Seo, Internal, SeoForward } from '@webergency-utils/server';

@Controller()
@Seo
class SeoController {
  constructor(private pages: PageRepo) {}

  @Get('/blog/:slug')
  async blog(@Param('slug') slug: string): Promise<SeoForward | void> {
    const page = await this.pages.findBySlug(slug);
    if (!page) return; // fall through to the next SEO match, then public routes
    return { method: 'GET', path: page.path, query: page.query };
  }
}

@Controller()
@Internal
class CheckoutInternal {
  @Get('/_internal/checkout')
  run() {
    return { ok: true };
  }
}
```

SEO handlers are matched before public routes and may only return a rewrite descriptor or void. `@Internal` paths are reachable only via `forward` / SEO rewrite (direct HTTP → 404).

`@Ip` uses `trustProxy` + TCP peer / `X-Forwarded-For` (see `ServerOptions.trustProxy`).

### Validation modes

* **`strict` (default)** — Reject undeclared properties.
* **`strip`** — Remove undeclared properties.
* **`relaxed`** — Validate known fields; allow extras.

Coercion via `from`:

* JSON body: revive Date / RegExp / bigint / Set / Map shapes; no `"30"` → `30`.
* Query / Param / Cookie / Header / Headers / Cookies / urlencoded: string coercion and single→array wrapping when needed.

### Types & helpers

* `ServerRequest` / `ServerResponse` / `EndpointRequest` / `EndpointResponse` / `ResponseBag` (alias) / `CookieOptions` / `Middleware` / `MiddlewareClass`
* `ServerWebSocket`, `PeerCert`, `PeerCertSubject`, `TlsOptions`
* `CorsOptions`, `SecurityOptions`, `Guard`, `Interceptor`, `Logger`, `LogContext`
* `Scope` (`SINGLETON` | `TRANSIENT` | `REQUEST`)
* `ConsoleLogger` / `NoOpLogger`
* `ApplicationRegistry`, `getRegistry`, `tryGetRegistry`, `runWithRegistry`
* `Router`, `Reflector`, `RequestContext` / `RequestContextStore`
* Symbol keys: `WEBERGENCY_CONTROLLER`, `WEBERGENCY_MODULE`, `WEBERGENCY_INJECTABLE`, `WEBERGENCY_METADATA`
* Meta readers: `getControllerMeta`, `getModuleMeta`, `getInjectableMeta`
* Path helpers: `pathCompiler`, `pathMatcher`, `pathToRE`, …
* IP helpers: `resolveClientIp`, `normalizeIp`, `ipInCidr`, `compileTrustProxy`, `TRUST_PROXY_LOOPBACK`, `TrustProxy`
* Peer helpers: `normalizePeerCert`, `needsNodeTlsCompat`, `tlsMaterialToString`

### Errors

`ServerError` (with `.status`), `HTTPServerError`, `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `PreconditionFailedError` (412), `RateLimitError` (429), `InternalServerError` (500), `ServiceUnavailableError` (503).  
`httpStatusFromError(err)` maps thrown values to an HTTP status for the fetch pipeline.

### Multi-runtime & mTLS

* **Bun / Deno** — Native serve for HTTP and basic TLS; mTLS/`requestCert`/SNI use Node `https`.
* **Node** — `http` / `https` Fetch bridge.

```typescript
import { Server, Controller, Get, Peer, PeerCert } from '@webergency-utils/server';
import fs from 'node:fs';

@Controller('/secure')
class SecureController {
  @Get('/profile')
  profile(@Peer cert: PeerCert) {
    return { cn: cert.subject.CN, serial: cert.serial };
  }
}

const server = new Server({
  port: 443,
  controllers: [SecureController],
  tls: {
    key: fs.readFileSync('server-key.pem'),
    cert: fs.readFileSync('server-cert.pem'),
    ca: fs.readFileSync('ca-cert.pem'),
    requestCert: true,
    rejectUnauthorized: true
  }
});

await server.start();
```

## Troubleshooting

### Decorators do nothing / routes 404 / “Missing AOT metadata”

**Cause:** Controllers were not compiled with the Webergency transformer.  
**Check:** Emitted class JS assigns `Symbol.for('webergency.server.controller')`.  
**Fix:** Compile with `npx webergency-tsc` (or the transformer plugin / `@webergency-utils/server/register`) before `server.start()`.

### `@Body` returns 415

**Cause:** Non-empty body with unsupported Content-Type, or `allowedContentTypes` set and Content-Type missing/not allowlisted when a body is indicated.  
**Fix:** Send `application/json`, `text/plain`, `application/x-www-form-urlencoded`, or `multipart/form-data` (via `@Body` DTO / `@File` / `@Files`), or omit the body. Buffered `formData()` / `file()` also work for small uploads.

### `@Ip` ignores `X-Forwarded-For`

**Cause:** `trustProxy` not set, or the immediate peer is outside the allowlist.  
**Fix:** Set `trustProxy: TRUST_PROXY_LOOPBACK` (local) or `trustProxy: ['10.0.0.0/8', ...]`.

## Maintenance

This package is actively maintained.

Bug reports and pull requests are welcome. Security issues and critical
regressions are prioritized. New features are considered when they align
with the package's existing scope.
