/**
 * Public entry point of the AOT compiler (`@webergency-utils/server/transformer`).
 *
 * The implementation lives in focused modules; this file only re-exports the surface that
 * ts-patch, `webergency-tsc`, and `register.ts` consume:
 *
 *   registry.ts           — the program-wide ProjectRegistry
 *   discovery.ts          — finding decorated classes across a program
 *   decorator-config.ts   — decorator constants and literal parsing
 *   sse-types.ts          — @Sse payload type unwrapping
 *   di-resolution.ts      — constructor/property injection tokens
 *   metadata-collector.ts — per-class decorator metadata and the merge rules
 *   endpoint-analyzer.ts  — the analysis transformer
 *   manifest.ts           — sidecar manifest generation
 *   plugin.ts             — the ts-patch plugin that emits Symbol.for metadata
 */
export type { ProjectRegistry } from './registry.js';
export { createRegistry } from './registry.js';
export { DiagnosticReporter, DiagnosticCode } from './diagnostics.js';
export type { DiagnosticSink } from './diagnostics.js';
export { discoverFromEntryPoint } from './discovery.js';
export { transformer } from './endpoint-analyzer.js';
export { generateManifestCode } from './manifest.js';
export { default } from './plugin.js';
