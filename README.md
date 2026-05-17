# @webergency-utils/server

**Zero-Reflection AOT Server Engine.**

A high-performance, industrial-grade web server framework designed for the modern JavaScript ecosystem. Built on a "Zero-Reflection" philosophy, it offloads metadata discovery and validation to a compile-time transformer, resulting in near-instant startups and zero runtime overhead.

---

## 🚀 Key Features

- **Ahead-of-Time (AOT) Transformation**: No `reflect-metadata` required. Routing and validation are "baked" into the code at build time.
- **Zero Runtime Overhead**: Validation is unrolled into optimized, zero-allocation property checks via `@webergency-utils/typechecker`.
- **Multi-Runtime Native**: Run the same codebase on **Node.js**, **Bun**, and **Deno** with automatic runtime detection.
- **Web Standard Foundation**: Built on the standard **Fetch API** (`Request`/`Response`).
- **Full Data Streaming**: Native support for request and response streaming across all runtimes.
- **Strict Validation Modes**: Granular control over data integrity with `strict`, `relaxed`, and `strip` modes.

---

## 📦 Installation

```bash
npm install @webergency-utils/server
npm install -D @webergency-utils/typechecker
```

---

## 🛠️ Usage

### 1. Define your Controller
Write standard, type-safe controllers using decorators. These decorators are used by the AOT engine and then stripped for production.

```typescript
import { Controller, Get, Post, Body, Param } from '@webergency-utils/server';

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
  // 'strip' mode automatically removes unknown properties from the body
  createUser(@Body('strip') user: User) {
    return user;
  }
}
```

### 2. Build (AOT Transformation)
Run the transformer to generate your server manifest and clean JavaScript controllers.

```bash
npx webergency-server-build
```

### 3. Start the Server
The `Endpoint` class automatically detects your runtime and starts the most efficient server available.

```typescript
import { Endpoint } from '@webergency-utils/server';
import './generated/metadata.js'; // The AOT-generated manifest

const server = new Endpoint({ port: 3000 });
await server.start();
```

---

## 🚦 Validation Modes

Our AOT engine supports three distinct validation modes for `@Body` and `@Query`:

- **`strict` (Default)**: Rejects the request if it contains any properties not defined in your TypeScript interface.
- **`strip`**: Automatically removes unknown properties, ensuring your controller only receives exactly what's defined in the type.
- **`relaxed`**: Validates required fields but allows extra properties to pass through.

---

## 🌍 Multi-Runtime Support

The server is built on the Fetch API, allowing it to run natively anywhere:

- **Bun**: Uses `Bun.serve` for maximum throughput.
- **Deno**: Uses `Deno.serve` with native Fetch support.
- **Node.js**: Uses a high-performance bridge to adapt Node's HTTP module to the Fetch API (requires Node 18+).

---

## 🔍 Decorator Reference

| Decorator | Description |
| :--- | :--- |
| `@Controller(path)` | Defines a base path for the class. |
| `@Get/Post/Put/Delete(path)` | Defines an HTTP route. |
| `@Body(mode?)` | Injects and validates the request body. |
| `@Param(name)` | Injects a path parameter. |
| `@Query(name?, mode?)` | Injects a specific query parameter or the whole object. |
| `@Header(name)` | Injects a specific request header. |
| `@Ip()` | Injects the client IP address. |
| `@Request()` | Injects the standard Web `Request` object. |
| `@RawBody()` | Injects the body as an `ArrayBuffer` (lazy/cached). |

---

## 📜 License

MIT
