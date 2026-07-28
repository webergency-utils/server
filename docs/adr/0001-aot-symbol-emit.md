# 0001 — Zero-reflection AOT via `Symbol.for`

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Webergency server maintainers

## Context

A decorator-driven HTTP framework needs route metadata, parameter sources, guards, and validators available at runtime. The common approaches are:

1. Runtime reflection (`reflect-metadata` + emitted design types).
2. A sidecar manifest written next to the build output and loaded at bootstrap.
3. A compile-time transform that writes the metadata into the emitted JavaScript itself.

We need startup to stay fast across Node, Bun, and Deno; validators must be type-accurate; and the package must not require a process-global metadata store.

## Decision

Decorators are compile-time markers only. The AOT transformer (exposed as `@webergency-utils/server/transformer`, the `webergency-tsc` CLI, and the optional `register` load-time host) analyzes each decorated class and emits:

- `Symbol.for('webergency.server.controller' | '…injectable' | '…module' | '…metadata')` assignments onto the class.
- File-local `__val_<hash>` validator functions closed over `@webergency-utils/typechecker/runtime`.

There is no sidecar manifest for normal builds and no process-global metadata store. Bootstrap fails fast if a declared controller host has no Symbol meta. Validators are deduplicated program-wide and emitted only into files that reference them.

`compiler/manifest.ts` remains as a legacy path for older consumers; the plugin path supersedes it.

## Consequences

- **Positive:** Zero reflection at runtime; validators match TypeScript types exactly; multiple `Server` instances cannot collide on shared metadata; Bun and Deno need no special reflection polyfills.
- **Negative:** Controllers must be compiled with the transformer (or `register`) before `start()`; plain `tsc` without the plugin produces silent empty routes.
- **Follow-ups:** Compiler diagnostics surface as `ts.Diagnostic` so `webergency-tsc` reports them alongside normal type errors.

## Related

- [CONTEXT.md](../../CONTEXT.md) — Controller, Endpoint, ApplicationRegistry
- README — “AOT compile (required)”
- [0002](./0002-per-server-registry.md) — where emitted meta is collected at bootstrap
