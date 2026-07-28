# 0005 — Observability: request IDs, health probes, no OpenTelemetry dependency

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Webergency server maintainers

## Context

Operators need three things from a process behind a load balancer or orchestrator:

1. Correlate a single request across logs and responses.
2. Probe liveness (process up) separately from readiness (bootstrapped, accepting traffic).
3. Optionally emit traces/metrics into an OpenTelemetry pipeline.

Adding `@opentelemetry/*` as a framework dependency would pull a large graph into every consumer, including those that already wrap the process with an OTel SDK or that use a different vendor agent.

## Decision

### Request ID

Every request accepts or generates `X-Request-Id`:

- Non-empty inbound header is kept as-is.
- Otherwise a UUID is minted.
- The value is stored on `AugmentedRequest.requestId` and `RequestContext.requestId`, included in every `LogContext` for that request, and echoed on the response.

Always on — no opt-out. Correlation is cheap and useful even for local development.

### Health / readiness

Optional via `ServerOptions.health`:

- `true` → `GET /health` (liveness) and `GET /ready` (readiness).
- `{ path?, readyPath? }` overrides the paths.

| Probe | 200 when | 503 when |
| --- | --- | --- |
| Liveness | Process can answer (adapter listening, or in-process `fetch`) | Never, while the process is alive |
| Readiness | Bootstrapped, listening (after `start()`), and not shutting down | Still bootstrapping, not yet listening, or shutting down |

Probes are answered before routing, guards, and CORS so a misconfigured app module cannot take them down.

### OpenTelemetry

Do **not** add an OpenTelemetry dependency. Existing extension points are enough for consumers to wire their own SDK:

- `Server.on('request' | 'error' | 'start' | 'shutdown', …)` for process-level spans and counters.
- Interceptors (`intercept(request, next)`) for per-route spans that wrap the handler.
- `X-Request-Id` / `RequestContext.requestId` as the correlation key to attach as a span attribute.

If a first-party OTel integration is ever needed, it should ship as a separate optional package (e.g. `@webergency-utils/server-otel`) rather than a core dependency.

## Consequences

- **Positive:** Correlation and k8s probes work out of the box; no OTel weight for apps that do not use it; interceptors remain the supported customisation surface.
- **Negative:** Trace context propagation (`traceparent`) is left to the consumer’s interceptor or edge proxy; the framework does not auto-create spans.
- **Follow-ups:** None required for 0.4.0.

## Related

- [CONTEXT.md](../../CONTEXT.md) — RequestContext
- [0002](./0002-per-server-registry.md) — per-Server isolation of request state
- README — ServerOptions `health`
