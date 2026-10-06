/**
 * Ref-counted broadcast subscriptions (browser only).
 *
 * Broadcast is topic-addressed: the server sends to `org:<id>:messages`, so the
 * browser must join EXACTLY that topic — no per-instance suffix like the
 * postgres_changes path uses. supabase-js returns the same channel object for
 * the same topic, so two hook instances on one topic must share it: this
 * registry keeps one channel per topic, fans each message out to every
 * listener, and only tears the channel down after the last listener leaves.
 *
 * Teardown is deferred (`RELEASE_DELAY_MS`): React strict mode (and fast
 * route changes) unmount + remount immediately, and re-joining a channel that
 * is mid-`unsubscribe()` is unreliable.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/browser";

export type BroadcastStatus =
  | "connecting"
  | "subscribed"
  | "channel_error"
  | "timed_out"
  | "closed";

export interface BroadcastMessage {
  event?: string;
  payload?: unknown;
}

interface Listener {
  event: string;
  onMessage: (message: BroadcastMessage) => void;
  onStatus: (status: BroadcastStatus) => void;
}

interface Entry {
  channel: RealtimeChannel;
  listeners: Set<Listener>;
  status: BroadcastStatus;
  releaseTimer: ReturnType<typeof setTimeout> | null;
}

const RELEASE_DELAY_MS = 1_500;
const entries = new Map<string, Entry>();

const STATUS_MAP: Record<string, BroadcastStatus> = {
  SUBSCRIBED: "subscribed",
  CHANNEL_ERROR: "channel_error",
  TIMED_OUT: "timed_out",
  CLOSED: "closed",
};

function openEntry(topic: string): Entry {
  const supabase = createClient();
  const listeners = new Set<Listener>();
  const entry: Entry = {
    channel: supabase.channel(topic),
    listeners,
    status: "connecting",
    releaseTimer: null,
  };
  entry.channel
    .on("broadcast", { event: "*" }, (message: BroadcastMessage) => {
      const event = (message.event ?? "").toLowerCase();
      for (const l of listeners) {
        if (l.event === "*" || l.event.toLowerCase() === event) l.onMessage(message);
      }
    })
    .subscribe((s) => {
      entry.status = STATUS_MAP[s] ?? "connecting";
      for (const l of listeners) l.onStatus(entry.status);
    });
  return entry;
}

/**
 * Listen to `event` (or `"*"`) on `topic`. Returns the unsubscribe function.
 * The listener's `onStatus` is called immediately with the current status.
 */
export function subscribeBroadcast(
  topic: string,
  event: string,
  onMessage: (message: BroadcastMessage) => void,
  onStatus: (status: BroadcastStatus) => void,
): () => void {
  let entry = entries.get(topic);
  if (!entry) {
    entry = openEntry(topic);
    entries.set(topic, entry);
  }
  if (entry.releaseTimer) {
    clearTimeout(entry.releaseTimer);
    entry.releaseTimer = null;
  }

  const listener: Listener = { event, onMessage, onStatus };
  entry.listeners.add(listener);
  onStatus(entry.status);

  const owned = entry;
  return () => {
    owned.listeners.delete(listener);
    if (owned.listeners.size > 0 || owned.releaseTimer) return;
    owned.releaseTimer = setTimeout(() => {
      owned.releaseTimer = null;
      if (owned.listeners.size > 0) return;
      if (entries.get(topic) === owned) entries.delete(topic);
      void createClient().removeChannel(owned.channel);
    }, RELEASE_DELAY_MS);
  };
}
