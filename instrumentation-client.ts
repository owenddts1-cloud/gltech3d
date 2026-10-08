// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { resolveSentryDsn } from "./lib/sentry/dsn";
import { createTracesSampler } from "./lib/sentry/sampling";

const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "x-api-key",
  "x-waha-api-key",
  "x-nuvemshop-token",
  "x-deskcomm-token",
];

function scrubMessage(input: string): string {
  return input
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "[CPF]")
    .replace(/\+?\d{2}\s?\d{4,5}-?\d{4}/g, "[PHONE]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]");
}

Sentry.init({
  dsn: resolveSentryDsn(
    typeof window !== "undefined" ? window.__PUBLIC_ENV__?.SENTRY_DSN : undefined,
  ),

  // Replay is NOT listed here on purpose: importing `replayIntegration` puts
  // ~37 KB gzip into the root chunk of every route. It is attached after the
  // page has loaded (see `loadReplayWhenIdle` below). The two replay sample
  // rates below are read by the integration when it is added, so their meaning
  // is unchanged.

  // 10% in production, 100% in dev; /monitoring (tunnel) and health checks
  // are never traced. See lib/sentry/sampling.ts.
  tracesSampler: createTracesSampler(),
  enableLogs: true,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: false,

  beforeSend(event) {
    if (event.request?.headers) {
      const headers = event.request.headers as Record<string, string>;
      for (const k of Object.keys(headers)) {
        if (SENSITIVE_HEADERS.includes(k.toLowerCase())) {
          delete headers[k];
        }
      }
    }
    if (typeof event.message === "string") {
      event.message = scrubMessage(event.message);
    }
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) ex.value = scrubMessage(ex.value);
      }
    }
    return event;
  },
});

/**
 * Attaches Session Replay once the page is loaded and the main thread is idle,
 * fetching the integration from the Sentry CDN (`lazyLoadIntegration`), so it
 * never competes with the first paint / hydration.
 *
 * Trade-off: an error thrown before Replay is attached has no replay buffer.
 * If the CDN is unreachable (offline, ad-blocker), the app keeps working and
 * errors are still reported — only replays are missing — and a breadcrumb
 * records why.
 */
function loadReplayWhenIdle(): void {
  if (typeof window === "undefined") return;
  // Telemetry disabled (SENTRY_DSN=off): do not fetch anything from the CDN.
  if (!Sentry.getClient()?.getDsn()) return;

  const attach = (): void => {
    Sentry.lazyLoadIntegration("replayIntegration")
      .then((replayIntegration) => {
        Sentry.addIntegration(replayIntegration());
      })
      .catch((err: unknown) => {
        Sentry.addBreadcrumb({
          category: "sentry.replay",
          level: "warning",
          message: `Replay lazy-load failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      });
  };

  const whenIdle = (): void => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(attach, { timeout: 5000 });
    } else {
      window.setTimeout(attach, 1000);
    }
  };

  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

loadReplayWhenIdle();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
