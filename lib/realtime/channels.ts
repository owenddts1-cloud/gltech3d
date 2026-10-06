/**
 * Canonical realtime channel names + broadcast payload contract.
 *
 * Pure module (no Supabase client import) so it can be shared by the server
 * broadcaster (`lib/realtime/broadcast.ts`) and the browser subscribers
 * (`hooks/realtime/useRealtimeChannel.ts`) without dragging either client into
 * the other bundle.
 *
 * Why broadcast instead of `postgres_changes`: the browser Supabase client has
 * no session (auth cookies are httpOnly — see docs/runbooks/sessao-do-browser.md),
 * so `postgres_changes` under RLS never delivers anything. The server, after a
 * successful write, broadcasts an ids-only "something changed" signal on a
 * per-org topic; the browser refetches through the authenticated API.
 *
 * Broadcast channels are public: anyone holding the anon key and the channel
 * name can listen AND publish. That is why payloads carry ONLY opaque ids + a
 * kind/status enum — never message text, names, phones or any other PII — and
 * why subscribers re-sanitize on receive (`readBroadcastPayload`), never render
 * payload content, and throttle the refetch it triggers. There is no
 * cross-tenant channel. Proper fix (private channels + Realtime Authorization)
 * is tracked in docs/runbooks/pendencias-em-aberto.md.
 */

/** Per-org topics. One channel per (org, topic). */
export type OrgRealtimeTopic =
  | "messages"
  | "conversations"
  | "leads"
  | "agent-runs"
  | "kb-sources";

export const ORG_REALTIME_TOPICS: readonly OrgRealtimeTopic[] = [
  "messages",
  "conversations",
  "leads",
  "agent-runs",
  "kb-sources",
] as const;

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `value` looks like a UUID (org ids are UUIDs). */
export function isUuid(value: string): boolean {
  return UUID_RX.test(value);
}

/**
 * `org:<orgId>:<topic>`. Throws on a non-UUID org id so a typo (or an empty
 * string) can never collapse every tenant onto one shared channel.
 */
export function orgChannel(orgId: string, topic: OrgRealtimeTopic): string {
  if (!isUuid(orgId)) {
    throw new Error(`[realtime] invalid organization id for channel: "${orgId}"`);
  }
  return `org:${orgId.toLowerCase()}:${topic}`;
}

/**
 * Non-throwing variant for render paths (hooks): null when `orgId` is missing
 * or not a UUID, so a bad value disables realtime instead of crashing the UI.
 */
export function safeOrgChannel(
  orgId: string | null | undefined,
  topic: OrgRealtimeTopic,
): string | null {
  if (!orgId || !isUuid(orgId)) return null;
  return orgChannel(orgId, topic);
}

export const orgMessagesChannel = (orgId: string): string => orgChannel(orgId, "messages");
export const orgConversationsChannel = (orgId: string): string =>
  orgChannel(orgId, "conversations");
export const orgLeadsChannel = (orgId: string): string => orgChannel(orgId, "leads");
export const orgAgentRunsChannel = (orgId: string): string => orgChannel(orgId, "agent-runs");
export const orgKbSourcesChannel = (orgId: string): string => orgChannel(orgId, "kb-sources");

/*
 * There is deliberately NO cross-tenant channel (e.g. a platform-admin inbox
 * feed). Channels are public (no Realtime Authorization yet), so a shared
 * channel would hand every tenant's activity to anyone with the anon key. The
 * platform-admin inbox polls instead (hooks/useAdminInbox.ts).
 */

/** Event names (lower-case: realtime-js lower-cases event names when matching). */
export const REALTIME_EVENTS = [
  "message.created",
  "message.updated",
  "conversation.created",
  "conversation.updated",
  "lead.created",
  "lead.updated",
  "lead.moved",
  "lead.deleted",
  "run.started",
  "run.updated",
  "run.completed",
  "run.failed",
  "source.created",
  "source.updated",
  "source.deleted",
] as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[number];

const REALTIME_EVENT_SET: ReadonlySet<string> = new Set<string>(REALTIME_EVENTS);

export function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  return typeof value === "string" && REALTIME_EVENT_SET.has(value);
}

/**
 * Ids-only payload. The closed key set IS the PII guard: there is no field
 * that could carry text written by a person.
 */
export interface RealtimeIdsPayload {
  conversation_id?: string;
  message_id?: string;
  lead_id?: string;
  lead_ids?: string[];
  pipeline_id?: string;
  run_id?: string;
  agent_id?: string;
  source_id?: string;
  /** Machine status enum (e.g. `completed`, `failed`) — never free text. */
  status?: string;
  is_dry_run?: boolean;
}

/** What subscribers receive in `message.payload`. */
export interface RealtimeBroadcastPayload extends RealtimeIdsPayload {
  kind: RealtimeEvent;
  /** ISO-8601 UTC emission time. */
  at: string;
}

type IdKey =
  | "conversation_id"
  | "message_id"
  | "lead_id"
  | "pipeline_id"
  | "run_id"
  | "agent_id"
  | "source_id";

const ID_KEYS: readonly IdKey[] = [
  "conversation_id",
  "message_id",
  "lead_id",
  "pipeline_id",
  "run_id",
  "agent_id",
  "source_id",
];

const STATUS_RX = /^[a-z_]{1,32}$/;
const MAX_LEAD_IDS = 500;

/**
 * Runtime defence in depth on top of the type: drops unknown keys, non-UUID
 * ids and non-enum statuses, so a caller casting its way around the type still
 * cannot leak text into a public channel.
 */
export function sanitizeRealtimePayload(input: RealtimeIdsPayload): RealtimeIdsPayload {
  const out: RealtimeIdsPayload = {};
  for (const key of ID_KEYS) {
    const value: unknown = input[key];
    if (typeof value === "string" && isUuid(value)) out[key] = value;
  }
  const leadIds: unknown = input.lead_ids;
  if (Array.isArray(leadIds)) {
    const ids = leadIds.filter((v): v is string => typeof v === "string" && isUuid(v));
    if (ids.length > 0) out.lead_ids = ids.slice(0, MAX_LEAD_IDS);
  }
  const status: unknown = input.status;
  if (typeof status === "string" && STATUS_RX.test(status)) out.status = status;
  const dryRun: unknown = input.is_dry_run;
  if (typeof dryRun === "boolean") out.is_dry_run = dryRun;
  return out;
}

const ISO_AT_RX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

/**
 * Parse an incoming broadcast message (`{ event, payload }`) — UNTRUSTED.
 *
 * Org channels are public: anyone who knows an org id can publish on them. So
 * the payload is re-sanitized on receive with the same allowlist the server
 * uses: unknown `kind` → null (ignored), unknown keys / non-UUID ids /
 * non-enum status dropped, `at` kept only if it is a plain ISO timestamp.
 * Consumers must still treat the result as a hint to refetch, never as data
 * to render.
 */
export function readBroadcastPayload(message: unknown): RealtimeBroadcastPayload | null {
  if (!message || typeof message !== "object") return null;
  const payload: unknown = (message as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const raw = payload as Record<string, unknown>;
  if (!isRealtimeEvent(raw.kind)) return null;
  const at = typeof raw.at === "string" && ISO_AT_RX.test(raw.at) ? raw.at : "";
  return {
    ...sanitizeRealtimePayload(raw as RealtimeIdsPayload),
    kind: raw.kind,
    at,
  };
}
