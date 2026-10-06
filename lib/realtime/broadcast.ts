/**
 * Server-side realtime broadcaster.
 *
 * After a successful write, the server tells the browsers of that org "this
 * changed" over a Supabase Realtime BROADCAST channel. The browser cannot use
 * `postgres_changes` (no session in the browser client — the auth cookie is
 * httpOnly; see docs/runbooks/sessao-do-browser.md), so this is the only
 * realtime path that actually delivers.
 *
 * Contract:
 *  - ids-only payloads (`RealtimeIdsPayload`, sanitized again at runtime);
 *    subscribers refetch through the authenticated API;
 *  - NEVER throws and never rejects: a failed broadcast is logged and the
 *    caller's write stays committed (the UI also polls as a safety net);
 *  - delivery is via the Realtime REST endpoint (`httpSend`) — no websocket is
 *    opened on the server, so it is safe in serverless/route handlers.
 *
 * Callers fire-and-forget through `deferBroadcast(() => broadcastOrg(...))`:
 * inside a request it runs in Next's `after()` (the response is not delayed
 * and the serverless function stays alive until it finishes); outside a
 * request scope (scripts, tests) it just runs detached.
 */
import { after } from "next/server";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  orgChannel,
  sanitizeRealtimePayload,
  type OrgRealtimeTopic,
  type RealtimeBroadcastPayload,
  type RealtimeEvent,
  type RealtimeIdsPayload,
} from "./channels";

const SEND_TIMEOUT_MS = 3_000;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** True when the Realtime server predates the explicit REST broadcast route. */
function isLegacyServerError(err: unknown): boolean {
  return /404|requires Realtime server/i.test(errorMessage(err));
}

async function sendToChannel(
  channelName: string,
  event: RealtimeEvent,
  payload: RealtimeIdsPayload,
): Promise<void> {
  const body: RealtimeBroadcastPayload = {
    ...sanitizeRealtimePayload(payload),
    kind: event,
    at: new Date().toISOString(),
  };

  try {
    const admin = createAdminClient();
    const channel = admin.channel(channelName);
    try {
      try {
        await channel.httpSend(event, body, { timeout: SEND_TIMEOUT_MS });
      } catch (err) {
        // Self-hosted Realtime < 2.97 has no `/events/:event` route. Fall back
        // to `send()`, which posts to the legacy `/api/broadcast` endpoint when
        // the channel is not joined (our case — we never subscribe here).
        if (!isLegacyServerError(err)) throw err;
        const res = await channel.send(
          { type: "broadcast", event, payload: body },
          { timeout: SEND_TIMEOUT_MS },
        );
        if (res !== "ok") throw new Error(`legacy broadcast returned "${res}"`);
      }
    } finally {
      await admin.removeChannel(channel);
    }
  } catch (err) {
    logger.warn("[realtime.broadcast] send failed", {
      channel: channelName,
      event,
      error: errorMessage(err),
    });
  }
}

/**
 * Broadcast an ids-only change signal on `org:<orgId>:<topic>`. Never throws.
 */
export async function broadcastOrg(
  orgId: string,
  topic: OrgRealtimeTopic,
  event: RealtimeEvent,
  payload: RealtimeIdsPayload,
): Promise<void> {
  let channelName: string;
  try {
    channelName = orgChannel(orgId, topic);
  } catch (err) {
    logger.warn("[realtime.broadcast] invalid channel", { topic, event, error: errorMessage(err) });
    return;
  }
  await sendToChannel(channelName, event, payload);
}

/**
 * A message was created/updated in a conversation: refresh the open thread and
 * the org's conversation list (preview/unread/last_message_at changed).
 * Per-org only — there is no cross-tenant channel (see channels.ts). Never throws.
 */
export async function broadcastMessageActivity(
  orgId: string,
  event: Extract<RealtimeEvent, "message.created" | "message.updated">,
  ids: { conversation_id: string; message_id?: string | null },
): Promise<void> {
  const payload: RealtimeIdsPayload = {
    conversation_id: ids.conversation_id,
    ...(ids.message_id ? { message_id: ids.message_id } : {}),
  };
  await Promise.all([
    broadcastOrg(orgId, "messages", event, payload),
    broadcastOrg(orgId, "conversations", "conversation.updated", {
      conversation_id: ids.conversation_id,
    }),
  ]);
}

/**
 * Schedule a broadcast without blocking the caller. Uses `after()` when inside
 * a request scope; otherwise (no request scope — scripts/tests) runs detached.
 * The task itself never rejects (every broadcaster above swallows + logs).
 */
export function deferBroadcast(task: () => Promise<void>): void {
  try {
    after(task);
  } catch (err) {
    logger.debug("[realtime.broadcast] after() unavailable, running detached", {
      error: errorMessage(err),
    });
    void task();
  }
}
