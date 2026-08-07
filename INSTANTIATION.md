# Instantiation & dependency injection

How providers are registered, constructed, and injected in `@webergency-utils/server`.

Runtime never reflects on types. The AOT transformer emits `static __injections__ = { constructorDeps, propertyDeps }` (and related Symbol meta). `DIContainer` only reads those tables and the provider objects you register.

Tokens are **strings**: a class’s `.name`, or an explicit `provide` string / `provide.name`.

---

## Mental model

```text
@Module providers / Server({ providers })
        │
        ▼
  register token → provider shape
        │
        ▼
  resolve(token) → instantiateProvider
        │
        ├─ class / useClass  → new cls(...deps) + property inject
        ├─ useValue          → return value as-is
        ├─ useFactory        → factory(...resolved inject)
        └─ bare object/primitive → return as-is
```

- **Visibility:** a token registered in a module is only reachable from another module if the owner **exports** it (or the owner is `@Global()` and exports it).
- **Scopes:** `Scope.DEFAULT` (singleton per module), `TRANSIENT` (new each resolve), `REQUEST` (once per request). A provider becomes request-scoped if any dependency is.
- **Cycles:** circular constructor deps resolve through a lazy `Proxy` (no `forwardRef` API).

---

## Catalog: registration / instantiation

### 1. Class provider

Register the class; the token is `Class.name`. The container constructs it with AOT constructor deps, then assigns property deps.

```ts
@Injectable()
export class ConfigService
{
    get( key: string ) { return process.env[key]! }
}

@Injectable()
export class UserModel
{
    constructor( private config: ConfigService ) {}
}

@Module({
    providers : [ ConfigService, UserModel ],
    exports   : [ UserModel ],
})
export class DatabaseModule {}
```

**When:** your own services, models, repositories that are concrete classes.

---

### 2. Custom token + `useClass`

Token may differ from the implementation class name. Useful for interface ports or stable public tokens.

```ts
export const USER_REPO = 'USER_REPO';

@Injectable()
export class MongoUserRepository implements UserRepository
{
    constructor( @Inject( 'MONGO_DB' ) private db: Db ) {}
    findById( id: string ) { /* ... */ }
}

@Module({
    providers : [
        { provide : USER_REPO, useClass : MongoUserRepository },
    ],
    exports : [ USER_REPO ],
})
export class UsersModule {}
```

Consumers inject with `@Inject(USER_REPO)`, not the interface type alone (interfaces erase).

---

### 3. Inject an existing instance — `useValue`

Pass a **pre-built** value. The container does not call `new`; it returns `useValue` as-is.

```ts
const db = await client.db();

@Module({
    providers : [
        { provide : 'MONGO_DB', useValue : db },
        { provide : 'APP_CONFIG', useValue : { env : 'prod', retries : 3 } },
        { provide : 'ANSWER', useValue : 42 },
    ],
    exports : [ 'MONGO_DB', 'APP_CONFIG' ],
})
export class DatabaseModule {}

@Injectable()
export class UserModel
{
    constructor(
        @Inject( 'MONGO_DB' ) private db: Db,
        @Inject( 'APP_CONFIG' ) private config: { env: string; retries: number },
    ) {}
}
```

**When:** Mongo/`Db` clients you already connected, config objects, feature flags, test mocks, any non-class value.

---

### 4. Bare object / primitive provider (implicit value)

If the registered provider is a non-function object **without** `useValue` / `useClass` / `useFactory`, or a primitive, the container returns it as-is (same outcome as `useValue`).

```ts
// Works today, but prefer explicit useValue for clarity
{ provide : 'Bare', already : true }
{ provide : 'Primitive', /* if registered as the number itself */ }
```

From the container’s point of view:

```ts
// object with no use* keys → return provider
// number / string / etc. → return provider
```

**Prefer** `{ provide: 'Bare', useValue: { already: true } }` so intent is obvious and you do not collide with `{ provide, useClass, … }` shapes by accident.

---

### 5. `useFactory` (+ `inject`)

Build the value with a function. Dependencies are listed as string tokens in `inject` (order matches factory parameters). Factories may be `async` if your bootstrap awaits them; list tokens explicitly — there is no AOT analysis of factory parameter types.

```ts
@Module({
    providers : [
        ConfigService,
        {
            provide    : 'MONGO_DB',
            useFactory : async ( config: ConfigService ) =>
            {
                const client = new MongoClient( config.get( 'DB_URL' ));
                await client.connect();
                return client.db();
            },
            inject : [ 'ConfigService' ],
        },
        {
            provide    : 'USER_MODEL',
            useFactory : ( db: Db ) => new UserModel( db ),
            inject     : [ 'MONGO_DB' ],
        },
    ],
    exports : [ 'MONGO_DB', 'USER_MODEL' ],
})
export class DatabaseModule {}
```

**When:** async connection setup, wrapping third-party clients, building a model that is not itself `@Injectable()`, conditional wiring.

---

### 6. Dynamic module object

Pass `{ module, providers?, imports?, exports?, controllers? }` where a static module class would go (e.g. in `imports`). Extra providers merge onto that module instance.

```ts
@Module({ providers : [ ConfigService ], exports : [ ConfigService ] })
export class ConfigModule {}

// At import site:
{
    module    : DatabaseModule,
    providers : [
        { provide : 'MONGO_DB', useFactory : connect, inject : [ 'ConfigService' ] },
    ],
    exports   : [ 'MONGO_DB' ],
}
```

**When:** configurable library modules (`forRoot`-style), tests that swap one binding.

---

### 7. Flat `Server({ providers })` (no module graph)

```ts
new Server({
    controllers : [ UsersController ],
    providers   : [ UsersService, UserModel, { provide : 'MONGO_DB', useValue : db } ],
});
```

No `exports` graph — everything is effectively root-level. Fine for tiny apps and tests; prefer modules for anything with boundaries.

---

### 8. Controllers, guards, interceptors

These are also constructed by the container (same `__injections__` / scopes). Register them on the module (or flat `Server` options). Constructor and property injection work like providers.

```ts
@Controller( '/users' )
export class UsersController
{
    constructor( private users: UsersService ) {}
}

@Injectable()
export class AuthGuard implements Guard
{
    constructor( private config: ConfigService ) {}
    use() { /* ... */ }
}

@Module({
    controllers  : [ UsersController ],
    providers    : [ UsersService, ConfigService ],
    // guards / interceptors ingested from Server options or module graph as applicable
})
export class UsersModule {}
```

---

### 9. `@Global()` module

Exported tokens from a global module are visible to other modules without each one importing it (still must be **exported**).

```ts
@Global()
@Module({
    providers : [ { provide : 'MONGO_DB', useValue : db } ],
    exports   : [ 'MONGO_DB' ],
})
export class DatabaseModule {}
```

Use sparingly (config, logging, DB root). Feature models usually stay non-global and are exported from a feature module.

---

### 10. Scopes

```ts
@Injectable({ scope : Scope.TRANSIENT })
export class ScratchPad {}

@Injectable({ scope : Scope.REQUEST })
export class RequestContextBag {}

@Module({
    providers : [
        ScratchPad,
        { provide : 'PerRequest', useClass : RequestContextBag, scope : Scope.REQUEST },
    ],
})
export class AppModule {}
```

- `DEFAULT` — one instance per `(token, module)`, cached.
- `TRANSIENT` — new instance every `resolve`.
- `REQUEST` — one instance per request; resolving outside a request throws.
- If any dependency is `REQUEST`, the consumer is treated as `REQUEST` too.

---

### 11. Circular dependencies

Two classes may depend on each other. While `A` is constructing, resolving `B` that needs `A` returns a lazy proxy; property access re-resolves to the real instance.

```ts
@Injectable()
export class A
{
    constructor( public b: B ) {}
}

@Injectable()
export class B
{
    constructor( public a: A ) {}
}
```

There is no `forwardRef()` helper — cycles are supported via the proxy. Prefer redesigning to avoid cycles when you can.

---

## Catalog: injection sites

### Constructor — type as token

```ts
constructor( private users: UserModel ) {}
// AOT → constructorDeps: ["UserModel"]
```

Requires a concrete class type. Do not use an interface type alone.

### Constructor — `@Inject(token)`

```ts
constructor(
    @Inject( 'MONGO_DB' ) private db: Db,
    @Inject( USER_REPO ) private users: UserRepository,
    @Inject( ConfigService ) private config: ConfigService, // equivalent to typed param
) {}
```

Use for string tokens, interface ports, and any type that is not a reliable class token.

### Property — `@Inject` required

Type alone is **not** enough on properties.

```ts
@Inject( LoggerService )
private logger!: LoggerService;
```

### Handler / guard method parameter — `@Inject`

```ts
@Get( '/x' )
handler( @Inject( UserModel ) users: UserModel ) { /* ... */ }

use( @Inject( 'MONGO_DB' ) db: Db ) { /* ... */ }
```

Resolved per call from the registry. Prefer constructor injection for permanent collaborators.

### Factory `inject` array

```ts
{
    provide    : 'X',
    useFactory : ( a: A, b: B ) => makeX( a, b ),
    inject     : [ 'A', 'B' ],
}
```

Not decorator-based; tokens are plain strings matching registered providers.

---

## Catalog: database / model recipes

### Shared client + class model

```ts
export const MONGO_DB = 'MONGO_DB';

@Injectable()
export class UserModel
{
    constructor( @Inject( MONGO_DB ) private db: Db ) {}
    collection() { return this.db.collection( 'users' ) }
}

@Injectable()
export class UsersService
{
    constructor( private users: UserModel ) {}
    get( id: string ) { return this.users.collection().findOne({ _id : id }) }
}

@Controller( '/users' )
export class UsersController
{
    constructor( private users: UsersService ) {}
    @Get( '/:id' )
    one( @Param( 'id' ) id: string ) { return this.users.get( id ) }
}

@Module({
    providers : [
        ConfigService,
        {
            provide    : MONGO_DB,
            useFactory : async ( c: ConfigService ) =>
            {
                const client = new MongoClient( c.get( 'DB_URL' ));
                await client.connect();
                return client.db();
            },
            inject : [ 'ConfigService' ],
        },
        UserModel,
    ],
    exports : [ UserModel, MONGO_DB ],
})
export class DatabaseModule {}

@Module({
    imports     : [ DatabaseModule ],
    controllers : [ UsersController ],
    providers   : [ UsersService ],
})
export class UsersModule {}
```

### Already-connected instance (`useValue`)

```ts
{ provide : MONGO_DB, useValue : existingDb }
```

### Interface port

```ts
export const USER_REPO = 'USER_REPO';

// providers:
{ provide : USER_REPO, useClass : MongoUserRepository }
// or
{ provide : USER_REPO, useFactory : ( db: Db ) => new MongoUserRepository( db ), inject : [ MONGO_DB ] }

// consumer:
constructor( @Inject( USER_REPO ) private users: UserRepository ) {}
```

### Layering (recommended)

```text
Controller  →  Service  →  Model / Repository  →  Db (token)
```

Do not inject the raw driver into controllers.

---

## Not supported today

| Nest / other DI feature | Status here |
|-------------------------|-------------|
| `useExisting` (alias provider) | Not supported |
| `@Optional()`, `@Self()`, `@SkipSelf()`, `@Host()` | Not supported |
| `InjectionToken` / `Symbol` as `provide` | Use **string** tokens (or a class’s `.name`) |
| `forwardRef()` | Cycles use a lazy proxy instead |
| `@InjectRepository()` / `@InjectModel()` sugar | Use `@Inject(token)` + your own token |
| Untyped / `any` constructor params as “optional” | Become token `'any'` → `undefined`; do not rely on this |

Missing registered tokens **throw** at resolve time.

---

## Recommended approaches (best → niche)

Sorted for application and database-model code. Prefer higher ranks unless you have a concrete reason to go lower.

| Rank | Approach | Use when | Avoid when |
|------|----------|----------|------------|
| **1** | **Class provider + typed constructor** | App services, your models/repos that are concrete classes | Dependency is an interface, driver type, or pre-built instance |
| **2** | **`useFactory` + string token** | Shared infra: DB client, pools, async connect, wrapping libs | Simple class with only class deps (use rank 1) |
| **3** | **`useValue` (inject instance / constant)** | Already-built `Db`, config objects, test doubles, scalars | You still need the container to construct a class with deps |
| **4** | **`provide` + `useClass`** | Interface ports, stable public token ≠ class name | Token can just be the class name (rank 1 is enough) |
| **5** | **Feature modules + `exports`** | Boundaries between domains; sharing models across features | Single-file apps (optional) |
| **6** | **Explicit `Scope.REQUEST` / `TRANSIENT`** | Per-request state, or truly ephemeral objects | Default singletons would work |
| **7** | **Property `@Inject`** | Cross-cutting optional-ish deps (logger) on a base class | Primary collaborators (put those in the constructor) |
| **8** | **Dynamic module extras** | Configurable packages / `forRoot`-style registration | Static module metadata is enough |
| **9** | **Flat `Server({ providers })`** | Smoke tests, prototypes, tiny scripts | Anything with module boundaries or reusable libraries |
| **10** | **Bare object / primitive providers** | — | Prefer explicit `useValue` (rank 3) for the same behaviour |
| **11** | **Method-level `@Inject`** | Rare: dep only needed inside one handler/guard method | Permanent collaborators (constructor) |

### Short defaults

1. Own class → register the class, inject by type.
2. Mongo/`Db`/pool → `MONGO_DB` token via `useFactory` or `useValue`, inject with `@Inject(MONGO_DB)`.
3. Interface → string token + `useClass` / `useFactory`, inject with `@Inject(TOKEN)`.
4. Controller talks to a **service**, service talks to a **model**, model talks to **Db**.

---

## Related

- [README.md](./README.md) — Dependency injection notes (tokens, memoization, lifecycle)
- [docs/adr/0001-aot-symbol-emit.md](./docs/adr/0001-aot-symbol-emit.md) — zero-reflection AOT
- [docs/adr/0002-per-server-registry.md](./docs/adr/0002-per-server-registry.md) — per-server registry & export graph
- Implementation: [`src/core/container.ts`](./src/core/container.ts), [`src/core/bootstrap.ts`](./src/core/bootstrap.ts), [`src/compiler/di-resolution.ts`](./src/compiler/di-resolution.ts)
