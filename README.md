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

Entry points:

| Export | Purpose |
| --- | --- |
| `@webergency-utils/server` | Runtime API |
| `@webergency-utils/server/transformer` | AOT compiler plugin |
| `@webergency-utils/server/register` | Optional load-time AOT host |
| `@webergency-utils/server/testing` | Test-only helpers for attaching AOT-shaped meta without the compiler |

## Architecture & Internals

1. **AOT transformer / `webergency-tsc`** — Analyzes controllers at build time; emits `Symbol.for` meta + typechecker validators into each file’s JS. Decorators are no-ops without that emit.
2. **Per-Server registry** — `ApplicationRegistry` is owned by each `Server` / `Microservice`. Bootstrap walks modules/controllers lazily on first `start()`/`fetch()`. Active registry is available to the request/DI stack via `getRegistry()` / `runWithRegistry()`.
3. **Adapters** — Maps Web Standard `Request` / `Response` to `Bun.serve`, `Deno.serve`, or Node `http`/`https` (Node 22+). Runtime is auto-detected.
4. **Pipeline** — Match route (linear first-match registration order) → security checks → middlewares → guards → interceptors → handler → response merge (`ResponseBag` headers/status).
5. **Body `from` modes** — Query, path, cookie, and `application/x-www-form-urlencoded` use typechecker `from: 'query'`. JSON bodies use `from: 'json'`. Missing Content-Type: sniff JSON then form-like urlencoded; other types → **415**.
6. **TLS** — Basic `cert`/`key` uses the native adapter on Bun/Deno. `requestCert` / `sniCallback` (mTLS / SNI) use Node `https` on all runtimes so `@Peer` works.

**Dependencies:** `@webergency-utils/typechecker` supplies runtime validators referenced by AOT-emitted code. Peer `typescript` (`^5 || ^6`) is required for `webergency-tsc`, the transformer plugin, and `register`. Package type is ESM (`"type": "module"`).

## Glossary

* **Controller** — Decorated class grouping HTTP/WS/SSE/RPC endpoints.
* **Endpoint** — Handler mapped to a verb + path (or RPC pattern).
* **Validation mode** — `strict` | `strip` | `relaxed` for body/query/response shaping.
* **`from`** — Typechecker coercion mode (`json` vs `query`) chosen from the parameter source / Content-Type.
* **ResponseBag** — Mutable headers/status bag shared by middleware and `@Response`.
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
| `security?` | `SecurityOptions \| boolean` | Global security / headers |
| `responseMode?` | `'strict' \| 'relaxed' \| 'strip'` | Default response validation mode |
| `tls?` | `TlsOptions` | TLS / mTLS |
| `trustProxy?` | `string[]` | Peer CIDR allowlist for XFF; omit/`[]` = never trust. Use `TRUST_PROXY_LOOPBACK` for local loopback peers. |
| `logger?` / `logs?` | `Logger` / `boolean` | Logging |
| `shutdownTimeout?` | `number` | Graceful shutdown wait |

**Methods:** `start()`, `shutdown()`, `fetch(request)` (in-process), `ensureReady()`, `getBody` / `getRawBody`, `on` / `off` for `start` | `beforeShutdown` | `shutdown` | `request` | `error`.  
**Property:** `registry` — the owning `ApplicationRegistry`.

```typescript
const server = new Server({ port: 3000, controllers: [UserController] });
await server.start();
await server.shutdown();
```

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
* `@Ws(path?, options?)` — WebSocket channel (`WsOptions`: `maxPayload?`, `pingInterval?`, `pingTimeout?`).
* `@Sse(path?)` — Server-Sent Events. Yield `{ event?, id?, retry?, data }` or a bare payload. Declared return types validate **each chunk’s `data`** (or the whole chunk); `strict` / `strip` / `relaxed` apply; failure aborts the stream after headers are sent.
* `@MessagePattern(pattern)` / `@EventPattern(pattern)` — TCP microservice patterns.
* `@Cors(config?)` / `@Security(config?)` — Per-route CORS / security.
* `@ResponseMode(mode)` — Per-handler response validation mode.
* `@Protect` / `@OverrideProtect` / `@Unprotect` — Guards.
* `@Intercept` / `@OverrideIntercept` / `@Unintercept` — Interceptors.
* `@Use` / `@OverrideUse` / `@Unuse` — Middlewares.
* `@Public` — Marks route/class public (framework-specific bypass metadata).
* `@Meta(...)` / `@SetMetadata(key, value)` — Arbitrary metadata for `Reflector`.
* `@Injectable(options?)` / `@Inject(token?)` / `@Module(metadata)` / `@Global()` — DI.
* Lifecycle interfaces: `OnModuleInit`, `OnApplicationBootstrap`, `OnModuleDestroy`, `BeforeApplicationShutdown`, `OnApplicationShutdown`.

### Parameter decorators

**No parentheses** (parameter index metadata): `@Request`, `@Context`, `@Response`, `@Headers`, `@Ip`, `@Url`, `@Hostname`, `@Path`, `@RawBody`, `@Peer`, `@Cookies`, `@Payload` (RPC body alias).

**With arguments:**

* `@Body(mode?)` — Parsed body. Modes: `strict` | `strip` | `relaxed`. JSON → `from: 'json'`; urlencoded → `from: 'query'`. Missing CT sniffs JSON then form; unsupported CT (including multipart) → **415**; bad JSON → **400**. Uploads: `@Request` + `req.formData()`.
* `@Query(name?, mode?)` — Query string (`from: 'query'`).
* `@Param(name)` / `@Header(name)` / `@Cookie(name)` — Path / header / cookie.
* `@ConnectedSocket()` — WebSocket instance for `@Ws`.

`@Response` injects the shared `ResponseBag` (same as middleware). Set `headers` / `status` (`statusCode` alias); the handler return value still supplies the body.

`@Ip` uses `trustProxy` + TCP peer / `X-Forwarded-For` (see `ServerOptions.trustProxy`).

### Validation modes

* **`strict` (default)** — Reject undeclared properties.
* **`strip`** — Remove undeclared properties.
* **`relaxed`** — Validate known fields; allow extras.

Coercion via `from`:

* JSON body: revive Date / RegExp / bigint / Set / Map shapes; no `"30"` → `30`.
* Query / Param / Cookie / urlencoded: string coercion and single→array wrapping when needed.

### Types & helpers

* `EndpointRequest` / `EndpointResponse` (`ResponseBag`) / `Middleware` / `MiddlewareClass`
* `ServerWebSocket`, `PeerCert`, `PeerCertSubject`, `TlsOptions`
* `CorsOptions`, `SecurityOptions`, `Guard`, `Interceptor`, `Logger`, `LogContext`
* `Scope` (`DEFAULT` | `TRANSIENT` | `REQUEST`)
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
**Fix:** Send `application/json` or `application/x-www-form-urlencoded`, or omit the body. Use `@Request` + `formData()` for multipart.

### `@Ip` ignores `X-Forwarded-For`

**Cause:** `trustProxy` not set, or the immediate peer is outside the allowlist.  
**Fix:** Set `trustProxy: TRUST_PROXY_LOOPBACK` (local) or `trustProxy: ['10.0.0.0/8', ...]`.

## Maintenance

This package is actively maintained.

Bug reports and pull requests are welcome. Security issues and critical
regressions are prioritized. New features are considered when they align
with the package's existing scope.
