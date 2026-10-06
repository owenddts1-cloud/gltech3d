/**
 * Realtime broadcast contract: channel names are per-org and validated, the
 * payload is ids-only (no PII can reach a public channel), and the server
 * broadcaster never throws — a failed broadcast must not fail the write.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const httpSend = vi.fn();
const send = vi.fn();
const removeChannel = vi.fn();
const channel = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    channel: (name: string) => {
      channel(name);
      return { httpSend, send };
    },
    removeChannel,
  }),
}));

import {
  broadcastMessageActivity,
  broadcastOrg,
  deferBroadcast,
} from "@/lib/realtime/broadcast";
import {
  ORG_REALTIME_TOPICS,
  orgChannel,
  orgLeadsChannel,
  orgMessagesChannel,
  readBroadcastPayload,
  safeOrgChannel,
  sanitizeRealtimePayload,
  type RealtimeIdsPayload,
} from "@/lib/realtime/channels";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const CONV = "33333333-3333-4333-8333-333333333333";
const MSG = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  httpSend.mockReset().mockResolvedValue({ success: true });
  send.mockReset().mockResolvedValue("ok");
  removeChannel.mockReset().mockResolvedValue("ok");
  channel.mockReset();
});

describe("channel names", () => {
  it("builds one channel per org and topic", () => {
    expect(orgMessagesChannel(ORG_A)).toBe(`org:${ORG_A}:messages`);
    expect(orgLeadsChannel(ORG_A)).toBe(`org:${ORG_A}:leads`);
    expect(orgChannel(ORG_A, "agent-runs")).toBe(`org:${ORG_A}:agent-runs`);
    expect(orgChannel(ORG_A, "kb-sources")).toBe(`org:${ORG_A}:kb-sources`);
    expect(orgChannel(ORG_A, "conversations")).toBe(`org:${ORG_A}:conversations`);
  });

  it("never lets two orgs share a channel", () => {
    for (const topic of ORG_REALTIME_TOPICS) {
      expect(orgChannel(ORG_A, topic)).not.toBe(orgChannel(ORG_B, topic));
    }
  });

  it("normalises case so server and browser agree on the topic", () => {
    expect(orgMessagesChannel(ORG_A.toUpperCase())).toBe(orgMessagesChannel(ORG_A));
  });

  it("rejects a non-UUID org id instead of collapsing tenants", () => {
    expect(() => orgChannel("", "messages")).toThrow();
    expect(() => orgChannel("undefined", "messages")).toThrow();
    expect(() => orgChannel(`${ORG_A}:x`, "messages")).toThrow();
  });

  it("safeOrgChannel disables (null) instead of throwing", () => {
    expect(safeOrgChannel(null, "messages")).toBeNull();
    expect(safeOrgChannel("nope", "messages")).toBeNull();
    expect(safeOrgChannel(ORG_A, "messages")).toBe(orgMessagesChannel(ORG_A));
  });

});

describe("payload sanitizer", () => {
  it("keeps ids and enums only", () => {
    const dirty = {
      conversation_id: CONV,
      message_id: MSG,
      status: "completed",
      is_dry_run: false,
      lead_ids: [CONV, "Maria da Silva"],
      body: "Oi, meu CPF é 123.456.789-00",
      phone_number: "+5511999999999",
    } as unknown as RealtimeIdsPayload;
    expect(sanitizeRealtimePayload(dirty)).toEqual({
      conversation_id: CONV,
      message_id: MSG,
      status: "completed",
      is_dry_run: false,
      lead_ids: [CONV],
    });
  });

  it("drops an id field that carries text", () => {
    const dirty = { conversation_id: "João <joao@x.com>" } as RealtimeIdsPayload;
    expect(sanitizeRealtimePayload(dirty)).toEqual({});
  });

  it("drops a status that is not an enum token", () => {
    expect(sanitizeRealtimePayload({ status: "Falhou: cliente xingou" })).toEqual({});
  });

});

describe("readBroadcastPayload (sanitize on receive — channels are public)", () => {
  it("reads a well-formed signal back", () => {
    const at = "2026-10-06T10:00:00.000Z";
    expect(
      readBroadcastPayload({
        event: "message.created",
        payload: { kind: "message.created", conversation_id: CONV, message_id: MSG, at },
      }),
    ).toEqual({ kind: "message.created", conversation_id: CONV, message_id: MSG, at });
  });

  it("drops injected fields, text in id slots and free-text status", () => {
    const parsed = readBroadcastPayload({
      payload: {
        kind: "run.failed",
        agent_id: CONV,
        status: "Clique aqui: http://phish.example",
        run_id: "<img src=x onerror=alert(1)>",
        body: "texto injetado",
        __proto__: { polluted: true },
        at: "amanhã",
      },
    });
    expect(parsed).toEqual({ kind: "run.failed", agent_id: CONV, at: "" });
  });

  it("ignores unknown kinds and malformed messages", () => {
    expect(readBroadcastPayload({ payload: { kind: "admin.grant", lead_id: CONV } })).toBeNull();
    expect(readBroadcastPayload({ payload: { kind: 42 } })).toBeNull();
    expect(readBroadcastPayload({ payload: { nokind: true } })).toBeNull();
    expect(readBroadcastPayload({ payload: [] })).toBeNull();
    expect(readBroadcastPayload({ payload: "message.created" })).toBeNull();
    expect(readBroadcastPayload(null)).toBeNull();
  });
});

describe("broadcastOrg", () => {
  it("sends an ids-only payload to the org channel over REST", async () => {
    await broadcastOrg(ORG_A, "messages", "message.created", {
      conversation_id: CONV,
      message_id: MSG,
      body: "segredo",
    } as unknown as RealtimeIdsPayload);

    expect(channel).toHaveBeenCalledWith(`org:${ORG_A}:messages`);
    expect(httpSend).toHaveBeenCalledTimes(1);
    const [event, payload] = httpSend.mock.calls[0] as [string, Record<string, unknown>];
    expect(event).toBe("message.created");
    expect(payload).toMatchObject({ kind: "message.created", conversation_id: CONV, message_id: MSG });
    expect(payload).not.toHaveProperty("body");
    expect(typeof payload.at).toBe("string");
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("never throws when the send fails", async () => {
    httpSend.mockRejectedValue(new Error("network down"));
    await expect(
      broadcastOrg(ORG_A, "leads", "lead.moved", { lead_id: CONV }),
    ).resolves.toBeUndefined();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("never throws when the admin client itself throws", async () => {
    removeChannel.mockRejectedValue(new Error("boom"));
    await expect(
      broadcastOrg(ORG_A, "leads", "lead.moved", { lead_id: CONV }),
    ).resolves.toBeUndefined();
  });

  it("never throws on an invalid org id (and sends nothing)", async () => {
    await expect(
      broadcastOrg("not-a-uuid", "messages", "message.created", {}),
    ).resolves.toBeUndefined();
    expect(httpSend).not.toHaveBeenCalled();
  });

  it("falls back to the legacy REST endpoint on an old Realtime server", async () => {
    httpSend.mockRejectedValue(new Error("httpSend() requires Realtime server v2.97.0 or newer; the endpoint returned 404."));
    await broadcastOrg(ORG_A, "conversations", "conversation.updated", { conversation_id: CONV });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ type: "broadcast", event: "conversation.updated" });
  });
});

describe("broadcastMessageActivity", () => {
  it("fans out to the org's thread and conversation-list channels only", async () => {
    await broadcastMessageActivity(ORG_A, "message.created", {
      conversation_id: CONV,
      message_id: MSG,
    });
    const names = channel.mock.calls.map((c) => c[0] as string);
    expect(names.sort()).toEqual([`org:${ORG_A}:conversations`, `org:${ORG_A}:messages`]);
  });

  it("never publishes on a cross-tenant channel", async () => {
    await broadcastMessageActivity(ORG_A, "message.created", { conversation_id: CONV });
    await broadcastMessageActivity(ORG_A, "message.updated", { conversation_id: CONV });
    for (const [name] of channel.mock.calls) {
      expect(name as string).toMatch(new RegExp(`^org:${ORG_A}:`));
    }
  });
});

describe("deferBroadcast", () => {
  it("runs the task even outside a request scope", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    deferBroadcast(task);
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);
  });
});
