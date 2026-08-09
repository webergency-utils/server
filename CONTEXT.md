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
The lifetime of a **Provider** instance: process-wide (`SINGLETON`), per-resolution (`TRANSIENT`), or per-request (`REQUEST`).

### Request pipeline

**Guard**:
A pre-handler gate that may reject a request (typically by throwing with a status). Does not wrap the handler.
_Avoid_: Middleware (a different concept), auth filter

**Interceptor**:
A wrap-around around the handler: receives `request` and a `next` callback and must call `next()` to continue.
_Avoid_: Guard, middleware

**Middleware**:
A pre-handler hook that can mutate the shared **ServerResponse**. Runs before **Guards**.
_Avoid_: Interceptor, pipe

**ServerRequest**:
Sealed request facade injected by `@Request` (and passed to middleware). Exposes string bags (`headers`, `cookies`, `query`, `params`), identity fields, and body helpers (`rawBody`, `formData`, `file`, `stream`, `multipart`, `upload`, `uploads`, `payload`). Not a Fetch `Request`.
_Avoid_: Request (Fetch), AugmentedRequest (internal)

**UploadedFile**:
One streaming multipart file part (`field`, `filename`, `mime`, `size`, `path?`, `buffer`, `save` / `skip`). Produced by the in-tree MultiBuffer parser and injected via `@File` / `@Files`.
_Avoid_: Fetch `File` from `formData()` (buffered platform path)

**MultipartPayload**:
Low-level multipart bag after streaming parse (`field` / `file` use wire names). `@Body` uses `toObject()`, which unflattens brackets like urlencoded `QueryParser`, then assert-validates with `from: 'query'`. Nested `multipart/*` parts are re-parsed with a prefix (`bundle[child]`, depth cap 3). Prefer DTOs like `{ profile: { name: string }; documents: UploadedFile[] }`.
_Avoid_: unbounded nested MIME (capped at `MAX_MULTIPART_NEST_DEPTH`)

**@File / FileOptions**:
Hierarchical upload config (ServerOptions.files → Module.files → controller → endpoint) and param injection for `UploadedFile`. See `docs/adr/0007-file-uploads-multipart.md`.
_Avoid_: sending multipart without `@File` limits in production (defaults still apply)

**ServerResponse**:
Mutable status/headers bag shared by middleware and `@Response`; merged onto the Fetch `Response` at the end of the pipeline. Chainable: `status(code, statusText?)`, `header`, `headers`, `cookie`, `stream(body)`, `redirect(code, url)`, `forward({ method, path, query?, body? })`. `stream` / endpoint returns accept bytes, Web `ReadableStream`, or Node `Readable`/`ReadStream` and **pipe** to the client (backpressured; not fully buffered). Returning a `ServerResponse` from a handler finalizes that facade as the HTTP response (no JSON serialization), unless `forward` is pending — then the framework re-dispatches internally (no `Location`). Empty/`null`/`undefined` cookie values clear. Not a Fetch `Response`.
_Avoid_: Response (the Fetch API object), ResponseBag (deprecated alias), setHeader/setCookie, reading a file into a Buffer before returning

**ResponseBag**:
Deprecated alias of **ServerResponse**.
_Avoid_: using the old name in new code

**RequestContext**:
Per-request AsyncLocalStorage bag holding the request, its **Endpoint** metadata, and request-scoped instances.

### Routing and runtime

**Router**:
Lookup structure that maps `(method, path)` to an **Endpoint**, or yields 405 + `Allow` when only other verbs match. The **Server** owns three instances: SEO, public, and internal.
_Avoid_: Matcher, dispatcher

**SeoForward**:
Rewrite descriptor `{ method, path, query?, body? }` returned from an `@Seo` handler or passed to `ServerResponse.forward`. Re-dispatched on public ∪ internal routers (SEO skipped).
_Avoid_: client redirect / Location, controller+method targeting

**@Seo**:
Paren-free class/method marker for the high-priority SEO route group. Handlers may only return `SeoForward` or void (fallthrough).
_Avoid_: putting content rendering in SEO handlers

**@Internal**:
Paren-free class/method marker for forward-only endpoints. Paths are registered but not reachable from external HTTP.
_Avoid_: exposing Internal paths publicly

**forward**:
In-process rewrite hop triggered by `SeoForward` or `ServerResponse.forward`. Nested hops allowed (max 16); cycles rejected. No client `Location`.
_Avoid_: `redirect` (client Location)

**Adapter**:
Runtime bridge that turns Web Standard `Request` / `Response` into `Bun.serve`, `Deno.serve`, or Node `http`/`https`.
_Avoid_: Transport, platform

**ApplicationRegistry**:
Per-**Server** (and per-**Microservice**) store of endpoints, DI bindings, and modules. Never process-global. Route uniqueness keys include the group (`seo` / `public` / `internal`).
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
> **Domain:** The **Adapter** turns the socket into a Fetch **Request**. The **Router** finds the **Endpoint** on the **Controller**. Then **Middleware**, then **Guards**, then **Interceptors** around the handler. The handler may use **ServerRequest** / **ServerResponse** facades; the **Adapter** sends the Fetch **Response**.
>
> **Dev:** And the body validator — is that `strict` or `json`?
>
> **Domain:** Both, for different jobs. **Validation mode** decides whether unknown properties fail or get stripped. **from** decides how strings are coerced — a JSON body uses `from: 'json'`, a form body uses `from: 'query'`.
>
> **Dev:** If I start two **Servers** in one process, do they share routes?
>
> **Domain:** No. Each **Server** owns its own **ApplicationRegistry**. The active one is only visible inside its AsyncLocalStorage stack.
