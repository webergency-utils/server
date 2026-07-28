# 0002 — Per-Server `ApplicationRegistry` with ALS activation

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Webergency server maintainers

## Context

Bootstrap must collect endpoints, DI bindings, and modules from AOT Symbol meta. A process-global registry (the historical NestJS / early Webergency pattern) makes it impossible to run two independent `Server` or `Microservice` instances in one process without route and token collisions. Tests that share a process also leak state across cases.

## Decision

Each `Server` and each `Microservice` owns an `ApplicationRegistry` instance (`server.registry`). Bootstrap, request handling, and DI resolution run inside `runWithRegistry(registry, fn)`, which binds the registry to an `AsyncLocalStorage` store. Callers reach the active registry with `getRegistry()`; calling it outside a store throws.

There is no process-global registry. Flat `registry.resolve(token)` only reaches providers the consuming module can see through its export graph — encapsulation is not bypassed.

## Consequences

- **Positive:** Multiple servers coexist; tests isolate cleanly via `runWithRegistry`; DI and routing state have a single owner.
- **Negative:** Code that reaches for `getRegistry()` outside `start` / `fetch` / an ALS-wrapped test helper fails loudly; adapters must already be inside the store when they call it.
- **Follow-ups:** Deprecated `MetadataStore` remains as a thin facade over `getRegistry()` for older internals and will be removed once call sites are gone.

## Related

- [CONTEXT.md](../../CONTEXT.md) — ApplicationRegistry, RequestContext
- [0001](./0001-aot-symbol-emit.md) — source of the meta the registry consumes
- README — “Per-Server registry”
