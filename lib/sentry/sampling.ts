/**
 * Shared Sentry `tracesSampler` (client, server and edge configs).
 *
 *  - 10% of transactions in production, 100% in development/test;
 *  - always 0 for noise that would eat the quota: the Sentry tunnel itself
 *    (`/monitoring`, see `tunnelRoute` in next.config.ts) and health checks
 *    (`/api/v1/health`, `/api/health`), which uptime monitors hit every minute;
 *  - an incoming trace's decision is inherited (`inheritOrSampleWith`), so a
 *    distributed trace is never half-sampled.
 *
 * Pure (no Sentry import) so it is unit-testable and safe for every runtime.
 */

export const PRODUCTION_TRACES_SAMPLE_RATE = 0.1;
export const DEVELOPMENT_TRACES_SAMPLE_RATE = 1;

const DROPPED_PATH_PREFIXES = ["/monitoring", "/api/v1/health", "/api/health"] as const;

/** Structural subset of Sentry's `TracesSamplerSamplingContext`. */
export interface TracesSamplerInput {
  name: string;
  attributes?: Record<string, unknown>;
  normalizedRequest?: { url?: string };
  location?: { pathname?: string };
  inheritOrSampleWith?: (fallbackSampleRate: number) => number;
}

export function baseTracesSampleRate(nodeEnv: string | undefined = process.env.NODE_ENV): number {
  return nodeEnv === "production" ? PRODUCTION_TRACES_SAMPLE_RATE : DEVELOPMENT_TRACES_SAMPLE_RATE;
}

/** "GET /api/v1/health", "https://x/api/v1/health?a=1", "/api/v1/health" → "/api/v1/health". */
function toPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  let v = value.trim();
  const methodPrefix = /^[A-Z]+\s+/.exec(v);
  if (methodPrefix) v = v.slice(methodPrefix[0].length);
  if (/^https?:\/\//i.test(v)) {
    try {
      v = new URL(v).pathname;
    } catch {
      return null; // not a URL after all — nothing to match against
    }
  }
  const q = v.search(/[?#]/);
  if (q >= 0) v = v.slice(0, q);
  return v.startsWith("/") ? v : null;
}

function matchesDropped(path: string): boolean {
  return DROPPED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** True when the transaction targets a path we never want to trace. */
export function isDroppedTransaction(ctx: TracesSamplerInput): boolean {
  const attrs = ctx.attributes ?? {};
  const candidates = [
    ctx.name,
    ctx.normalizedRequest?.url,
    ctx.location?.pathname,
    attrs["url.path"],
    attrs["http.target"],
    attrs["http.route"],
    attrs["next.route"],
    attrs["url.full"],
    attrs["http.url"],
  ];
  return candidates.some((c) => {
    const path = toPath(c);
    return path !== null && matchesDropped(path);
  });
}

export function createTracesSampler(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): (ctx: TracesSamplerInput) => number {
  const rate = baseTracesSampleRate(nodeEnv);
  return (ctx) => {
    if (isDroppedTransaction(ctx)) return 0;
    return ctx.inheritOrSampleWith ? ctx.inheritOrSampleWith(rate) : rate;
  };
}
