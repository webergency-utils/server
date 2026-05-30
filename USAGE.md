# @webergency/server USAGE

Webergency is a zero-reflection, AOT-compiled web server designed for maximum performance on Node.js, Bun, and Deno. It resolves all decorators, validation schemas, and middleware chains at build-time.

## 📦 Installation

```bash
npm install @webergency/server
```

## ⚙️ Required tsconfig.json

Your project must use the following `compilerOptions` to support the AOT transformer:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": false, // Not needed! We use AOT analysis instead.
    "strict": true
  }
}
```

## 🚀 Creating a Controller

```typescript
import { Controller, Get, Param, Protected } from '@webergency/server';
import { AuthGuard } from './guards/auth.guard';

@Controller('/api')
export class ApiController {
  @Protected(AuthGuard)
  @Get('/hello/:name')
  sayHello(@Param('name') name: string) {
    return { message: `Hello ${name}` };
  }
}
```

## 🛠️ The AOT Build (CLI)

Instead of complex build scripts, Webergency provides a zero-config CLI to generate your AOT manifest.

```bash
# Just run it from the project root!
npx webergency-server-build
```

The CLI will automatically:
1.  Find your entry point (e.g., `src/index.ts`, `src/main.ts`).
2.  Trace all controllers, guards, and interceptors.
3.  Generate the `_metadata.webergency-server.js` manifest in your project root.

- **--entry / -e**: (Optional) Path to your entry point if it's in a non-standard location.
- **--output / -o**: (Optional) Custom filename for the manifest.

## 🏁 Running the Server

In your entry point (e.g., `main.ts`):

```typescript
import { Server } from '@webergency/server';

const server = new Server({
  port: 3000
});

server.on('start', (port) => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
});

server.start();
```

> [!NOTE]
> The server automatically loads the `_metadata.webergency-server.js` manifest from the project root if it exists.

## 🛡️ Key Features

- **@Protected(Guard)**: Statically wired security.
- **@Intercept(Interceptor)**: Zero-overhead middleware chains.
- **Mutual TLS (mTLS)**: Setup secure connections with client certificates by configuring `tls.requestCert: true` and `tls.rejectUnauthorized: true`.
- **@Peer()**: Inject client certificate metadata (matching the exportable `PeerCert` interface) into guards, controller endpoints, or other injected parameters.
- **Automatic Validation**: DTOs are analyzed and validators are pre-compiled into the manifest.
- **Graceful Shutdown**: Built-in support for `SIGTERM`/`SIGINT`.
- **Cross-Runtime**: Identical code works on Node, Bun, and Deno.

