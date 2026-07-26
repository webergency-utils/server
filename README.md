# @webergency-utils/server

A high-performance, industrial-grade web server framework designed for the modern JavaScript ecosystem. Built on a "Zero-Reflection" philosophy, it offloads metadata discovery and validation to a compile-time transformer, resulting in near-instant startups and zero runtime overhead.

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

---

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

// Start the server (automatically detects runtimes like Bun, Deno, or Node.js)
const server = new Server({
  port: 3000,
  controllers: [UserController]
});

await server.start();
```

---

## Installation & Setup

Install the core package along with development dependencies (TypeScript compiler transformer components):

```bash
npm install @webergency-utils/server
npm install -D typescript ts-patch @webergency-utils/typechecker
```

### `tsconfig.json` Configuration

Enable ahead-of-time (AOT) routing and validation by registering the server plugin transformer in your compiler options:

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

---

## Architecture & Internals

The framework is built on a clean decoupling of compile-time logic and runtime abstraction:

1. **Ahead-of-Time (AOT) Compiler Transformer:** AST transformations run during build/transpilation time. The transformer unrolls decorator metadata, registers routes, and compiles `@webergency-utils/typechecker` validators into inline binary/property checks directly. This eliminates dynamic reflection (`reflect-metadata`) and minimizes runtime startup latency.
2. **Runtime HTTP Adapters:** The framework natively adopts Web Standard `Request` and `Response` fetch boundaries. A thin native bridge maps routing requests to runtime-specific server utilities (`Bun.serve`, `Deno.serve`, or Node's `http.createServer`).
3. **Execution Pipeline:** Incoming requests are routed via a highly-optimized radix router, passed through middlewares, checked against class and method-level guards, intercepted by response adapters, and finally handled by controller endpoints.
4. **Request coercion (`from`):** Parameter validators receive a typechecker `from` mode based on the source. Query, path params, and cookies use `from: 'query'` (string coercion and single-value→array wrapping). JSON bodies use `from: 'json'` (Date/RegExp/bigint/Set/Map revival only). `application/x-www-form-urlencoded` bodies are parsed like querystrings and validated with `from: 'query'`.

**Runtime dependency:** `@webergency-utils/typechecker` (validators and AOT compilation). **Peer dependency:** `typescript` `>=5.0.0` (compiler API for the transform plugin).

---

## Glossary

* **Controller:** A decorated class that groups related HTTP routes and provides Dependency Injection scopes.
* **Endpoint:** An individual handler method within a controller mapped to an HTTP verb and path.
* **Validation Mode:** A setting (`strict`, `strip`, or `relaxed`) controlling how type mismatches and extra body/query parameters are validated.
* **`from`:** Typechecker input conversion mode applied per parameter source (`json` for JSON bodies, `query` for querystrings, path/cookie values, and urlencoded bodies).
* **Radix Router:** The underlying tree-structured matcher used for fast parameter route resolution.
* **Server Adapter:** A bridge mapping web standard Fetch API objects to native runtime socket/HTTP engines.

---

## API Reference

### Classes

#### `Server`
The main class to orchestrate, initialize, and start the application server.

**Options Config Interface (`ServerOptions`):**
* `port` (`number`): Port to bind the server to.
* `controllers` (`any[]`): Array of controller classes to register.
* `cors?` (`CorsOptions`): Server-wide Cross-Origin Resource Sharing rules.
* `security?` (`SecurityOptions | boolean`): Global security settings (e.g. allowed content types).
* `tls?` (`TlsOptions`): mTLS cert configuration keys.

```typescript
const server = new Server({ port: 3000, controllers: [UserController] });
await server.start();
await server.shutdown();
```

---

### Parameter Decorators (Strict - Parentheses-Free)

These decorators inject context variables directly into endpoint handler arguments. **Must be called without parentheses.**

* **`@Request`**: Injects the raw web standard `Request` object.
* **`@Context`**: Injects the current request execution context.
* **`@Response`**: Injects the custom response mapping wrapper.
* **`@Headers`**: Injects the request headers map.
* **`@Ip`**: Injects the caller IP address.
* **`@Peer`**: Injects the TLS client certificate information (`PeerCert`) for secure connections.
* **`@Cookies`**: Injects parsed request cookies as a `Record<string, string>`.

---

### Parameter Decorators (Hybrid / With Arguments)

* **`@Body(mode?)`**: Injects the validated request body. Supports `strict`, `strip` (removes undeclared keys), and `relaxed` validation modes. Parses `application/json` (default) with `from: 'json'`, and `application/x-www-form-urlencoded` with `from: 'query'`.
* **`@Query(name?, mode?)`**: Injects a specific query parameter or parses the entire query object. Validated with `from: 'query'` (string→number/boolean/Date coercion, array wrapping).
* **`@Param(name)`**: Injects a named route path parameter (validated with `from: 'query'` when typed).
* **`@Header(name)`**: Injects a specific header value.
* **`@Cookie(name)`**: Injects a specific cookie value (validated with `from: 'query'` when typed).
* **`@ConnectedSocket()`**: Injects the raw websocket instance for `@Ws` channels.

---

### Route Decorators

Class and method-level route endpoints:

* **`@Controller(path)`**: Declares the base path and scopes for all nested endpoints in the class.
* **`@Get(path?)` / `@Post(path?)` / `@Put(path?)` / `@Delete(path?)` / `@Patch(path?)` / `@Head(path?)` / `@All(path?)`**: Maps methods to standard HTTP route verbs.
* **`@Ws(path?, options?)`**: Binds endpoint to a WebSocket connection channel.
* **`@Sse(path?)`**: Binds endpoint to a Server-Sent Events stream.

---

## 🚦 Validation Modes

Our AOT engine supports three distinct validation modes for `@Body` and `@Query`:

* **`strict` (Default)**: Rejects the request if it contains any properties not defined in your TypeScript interface.
* **`strip`**: Automatically removes unknown properties, ensuring your controller only receives exactly what's defined in the type.
* **`relaxed`**: Validates required fields but allows extra properties to pass through.

Coercion is separate from mode and comes from typechecker `from`:

* **JSON body** (`Content-Type: application/json`): `from: 'json'` — revives Date, RegExp, bigint, Set, and Map shapes. Does **not** coerce `"30"` → `30`.
* **Query / Param / Cookie** and **urlencoded body** (`application/x-www-form-urlencoded`): `from: 'query'` — querystring-style coercion (including single values wrapped into arrays when an array is expected).

---

## 🌍 Multi-Runtime Support

The server is built on the Fetch API, allowing it to run natively anywhere:

* **Bun**: Uses `Bun.serve` for maximum throughput.
* **Deno**: Uses `Deno.serve` with native Fetch support.
* **Node.js**: Uses a high-performance bridge to adapt Node's HTTP module to the Fetch API (requires Node 18+).

---

## 🔒 Mutual TLS (mTLS) & `@Peer` Decorator

The framework supports mutual TLS authentication (client certificate validation) across Node.js and Bun adapters.

### 1. Configure the Server for mTLS
Provide `requestCert: true` and `rejectUnauthorized: true` inside `tls` options:

```typescript
import { Server } from '@webergency-utils/server';
import fs from 'fs';

const server = new Server({
  port: 443,
  controllers: [SecureController],
  tls: {
    key: fs.readFileSync('server-key.pem'),
    cert: fs.readFileSync('server-cert.pem'),
    ca: fs.readFileSync('ca-cert.pem'), // Trusted CA for client certs
    requestCert: true,
    rejectUnauthorized: true
  }
});

await server.start();
```

### 2. Inject Client Certificate Details
Use the `@Peer` parameter decorator to inject the peer certificate:

```typescript
import { Controller, Get, Peer, PeerCert } from '@webergency-utils/server';

@Controller('/secure')
export class SecureController {
  @Get('/profile')
  getSecureProfile(@Peer cert: PeerCert) {
    return {
      message: `Hello ${cert.subject.CN}!`,
      organization: cert.subject.O,
      validTo: cert.valid.to,
      serial: cert.serial
    };
  }
}
```

---

## Maintenance

This package is actively maintained.

Bug reports and pull requests are welcome. Security issues and critical
regressions are prioritized. New features are considered when they align
with the package's existing scope.
