# 0009 — Portable host-class AOT for published libraries

- **Status:** Accepted
- **Date:** 2026-08-16
- **Deciders:** Webergency server maintainers
- **Amends:** [0001](./0001-aot-symbol-emit.md)

## Context

[0001](./0001-aot-symbol-emit.md) puts route and validator AOT on the **controller** class. Guard `@Header` / `@Request` metadata was copied into that controller emit when the **app** compiled `@Protect(Guard)`. That only works if the transformer sees a decorated `use()` AST.

Published `.d.ts` strips parameter decorators. Bundlers such as tsup drop `Symbol.for` / `__injections__`. Library guards therefore could be imported but not used: `@Protect(ApiKeyGuard)` recorded a name with empty `params`, so headers never injected.

Module emit aliased `Class.__moduleMetadata__`, which still required the runtime `@Module()` decorator to run.

## Decision

**The class that owns the decorators owns the AOT.** After `webergency-tsc`:

- Guards emit `Symbol.for('webergency.server.guard')` with `params` (parser identifiers are file-local `__parse_*` in the **library** module).
- Modules emit `Symbol.for('webergency.server.module')` as identifier refs (`controllers: [Foo]`, not a runtime bag alias).
- Injectable `scope` is stored on `webergency.server.injectable`.

Consumer apps record **class identity + use-site static args** only (`@Protect(RoleGuard, 'admin')`). `invokeGuards` reads `params` from the guard class when present; otherwise it falls back to endpoint-baked params (older emits).

Library packages must compile with `webergency-tsc` (or the transformer). Do not re-bundle with esbuild/tsup in a way that strips `Symbol.for` or `__injections__`. Dual CJS, if needed, must keep those assignments.

## Consequences

- **Positive:** `@Protect(LibGuard)` works against published `dist` JS + `.d.ts`. Library guard changes do not require the app to re-analyze decorator AST.
- **Negative:** Libraries built with tsup / plain `tsc` still have no host meta. `Server({ guards })` still only registers DI; routes need `@Protect`.
- **Follow-ups:** Ramp `@ramp-global/server` must switch its publish pipeline to `webergency-tsc`.

## Related

- [0001](./0001-aot-symbol-emit.md) — Symbol.for emit
- README — “AOT compile (required)” / library packages
