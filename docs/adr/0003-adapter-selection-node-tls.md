# 0003 — Runtime adapter selection with Node-TLS compat

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Webergency server maintainers

## Context

The public API is Web Standard `Request` / `Response`. The underlying listener differs per runtime (`Bun.serve`, `Deno.serve`, Node `http`/`https`). Bun and Deno accept `cert`/`key` for TLS but do not expose peer certificates, `requestCert`, or SNI callbacks — features required for `@Peer` and mTLS.

Duplicating the “when to fall back to Node https” decision in each adapter invited drift; the WS heartbeat and upgrade query parsing already showed the same problem.

## Decision

`Server` auto-detects the runtime (`globalThis.Bun` → Bun, `globalThis.Deno` → Deno, else Node) and constructs the matching `ServerAdapter`.

For TLS:

- Basic `cert` / `key` stays on the native Bun or Deno listener.
- When `tls.requestCert` or `tls.sniCallback` is set, Bun and Deno adapters delegate the **entire** listener to `NodeTlsCompat`, which constructs a `NodeAdapter` under the current runtime. Upgrades and shutdown follow the same delegation while it is active.

Shared pieces live outside the adapters:

- `adapters/ws-heartbeat.ts` — ping/pong liveness
- `adapters/ws-upgrade.ts` — upgrade query flattening
- `adapters/node-tls-compat.ts` — the Node https delegation helper
- `helpers/peer-cert.ts` — `needsNodeTlsCompat` predicate

## Consequences

- **Positive:** `@Peer` and mTLS work identically on all three runtimes; adapters stay thin; heartbeat / query / TLS-compat behaviour cannot diverge.
- **Negative:** An mTLS Bun/Deno deployment still pays the Node https path; native Bun/Deno TLS features beyond cert/key are unused when compat is active.
- **Follow-ups:** Node adapter timeouts and keep-alive drain are hardened separately (Phase 4).

## Related

- [CONTEXT.md](../../CONTEXT.md) — Adapter
- README — “TLS” architecture bullet, “Multi-runtime & mTLS”
