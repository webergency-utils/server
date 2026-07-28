# Server

HTTP / WebSocket / RPC server framework for Node, Bun, and Deno. Controllers, modules, and validators are compiled ahead of time; the runtime never reflects on types.

## Language

### Composition

**Controller**:
A class that owns one or more **Endpoints**. Marked at compile time; empty at runtime without AOT emit.
_Avoid_: Router class, handler class

**Endpoint**:
A single handler bound to an HTTP verb + path, a WebSocket upgrade path, an SSE stream, or an RPC pattern.
_Avoid_: Route (reserved for the matched path entry inside the **Router**), handler

**Module**:
A composition unit that declares `imports`, `controllers`, `providers`, and `exports`. The unit of encapsulation for DI.
_Avoid_: App, plugin, package

**Provider**:
A class or value token registered for dependency injection inside a **Module**.
_Avoid_: Service (too vague), injectable (the decorator name, not the concept)

**Scope**:
The lifetime of a **Provider** instance: process-wide (`DEFAULT`), per-resolution (`TRANSIENT`), or per-request (`REQUEST`).

### Request pipeline

**Guard**:
A pre-handler gate that may reject a request (typically by throwing with a status). Does not wrap the handler.
_Avoid_: Middleware (a different concept), auth filter

**Interceptor**:
A wrap-around around the handler: receives `request` and a `next` callback and must call `next()` to continue.
_Avoid_: Guard, middleware

**Middleware**:
A pre-handler hook that can mutate the shared **ResponseBag**. Runs before **Guards**.
_Avoid_: Interceptor, pipe

**ResponseBag**:
Mutable headers/status bag shared by middleware and `@Response` parameters; merged onto the Fetch `Response` at the end of the pipeline.
_Avoid_: Response (the Fetch API object), reply

**RequestContext**:
Per-request AsyncLocalStorage bag holding the request, its **Endpoint** metadata, and request-scoped instances.

### Routing and runtime

**Router**:
Lookup structure that maps `(method, path)` to an **Endpoint**, or yields 405 + `Allow` when only other verbs match.
_Avoid_: Matcher, dispatcher

**Adapter**:
Runtime bridge that turns Web Standard `Request` / `Response` into `Bun.serve`, `Deno.serve`, or Node `http`/`https`.
_Avoid_: Transport, platform

**ApplicationRegistry**:
Per-**Server** (and per-**Microservice**) store of endpoints, DI bindings, and modules. Never process-global.
_Avoid_: MetadataStore (deprecated facade), container (the DI engine inside it)

### Validation

**Validation mode**:
How a value is shaped against its TypeScript type: `strict` (reject extras), `strip` (drop extras), or `relaxed` (keep extras).
_Avoid_: from (a different concept)

**from**:
Typechecker coercion channel chosen at validate time: `json` (structured values, no `"30"` → `30`) or `query` (string coercion / array wrapping). Selected from the parameter source and body Content-Type.
_Avoid_: Validation mode, content type

## Example dialogue

> **Dev:** So when someone hits `POST /users`, what runs?
>
> **Domain:** The **Adapter** turns the socket into a Fetch **Request**. The **Router** finds the **Endpoint** on the **Controller**. Then **Middleware**, then **Guards**, then **Interceptors** around the handler. The handler writes through a **ResponseBag**; the **Adapter** sends the Fetch **Response**.
>
> **Dev:** And the body validator — is that `strict` or `json`?
>
> **Domain:** Both, for different jobs. **Validation mode** decides whether unknown properties fail or get stripped. **from** decides how strings are coerced — a JSON body uses `from: 'json'`, a form body uses `from: 'query'`.
>
> **Dev:** If I start two **Servers** in one process, do they share routes?
>
> **Domain:** No. Each **Server** owns its own **ApplicationRegistry**. The active one is only visible inside its AsyncLocalStorage stack.
