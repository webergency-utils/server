# 0004 — Typechecker `from` modes keyed by parameter source

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Webergency server maintainers

## Context

`@webergency-utils/typechecker` validators accept a `from` channel that controls coercion: `json` keeps structured values as-is (a JSON string `"30"` stays a string), while `query` coerces strings to the declared TypeScript type and wraps singleton values into arrays when needed. Choosing the wrong channel either rejects valid form posts or silently accepts typed JSON that should have failed.

Parameter sources arrive as different wire shapes:

| Source | Wire shape |
| --- | --- |
| `@Body` with `application/json` | Structured JSON |
| `@Body` with `application/x-www-form-urlencoded` | Flat string map |
| `@Query` / `@Param` / `@Cookie` | Flat string map |
| Missing Content-Type | Sniffed: JSON first, then form-like urlencoded; otherwise 415 |

`Validation mode` (`strict` / `strip` / `relaxed`) is a separate axis and must not be conflated with `from`.

## Decision

`RequestProcessor.resolveParam` sets `ctx.from` as follows:

- `@Query`, `@Param`, `@Cookie` → `'query'`
- `@Body` with effective Content-Type `application/x-www-form-urlencoded` → `'query'`
- `@Body` otherwise (JSON, including sniffed JSON) → `'json'`

Effective Content-Type comes from `getEffectiveBodyContentType` in `helpers/request-reader.ts`: declared header, else sniff. Unsupported types yield **415** before validation runs.

`@Header` and the whole-bag `@Cookies` source do not set `from`; they are not coerced through the typechecker channel.

## Consequences

- **Positive:** Form posts and query strings coerce predictably; JSON bodies keep type fidelity; 415 surfaces protocol mistakes early.
- **Negative:** Authors must understand two axes (`from` vs validation mode); a handler typed `age: number` accepts `"30"` from a query but rejects `"30"` from JSON.
- **Follow-ups:** Keep README coercion table and CONTEXT glossary aligned whenever a new parameter source is added.

## Related

- [CONTEXT.md](../../CONTEXT.md) — from, Validation mode
- README — “Body `from` modes”, parameter decorator docs
- `@webergency-utils/typechecker` — coercion implementation
