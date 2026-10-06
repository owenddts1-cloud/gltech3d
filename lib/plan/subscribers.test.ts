import { describe, it, expect } from "vitest";

import {
  countMembers,
  decodeSubscriberCursor,
  encodeSubscriberCursor,
  pickOwners,
  sanitizeSearch,
  type MembershipLite,
} from "./subscribers";

describe("sanitizeSearch", () => {
  it("remove o que reescreveria o filtro do PostgREST", () => {
    expect(sanitizeSearch("acme),plan.eq.pro,(x")).toBe("acmeplan.eq.prox");
    expect(sanitizeSearch("50%*")).toBe("50");
  });
  it("mantém acentos, e-mail e hífen", () => {
    expect(sanitizeSearch("  Impressões São-João@x.com ")).toBe("Impressões São-João@x.com");
  });
  it("vazio vira null", () => {
    expect(sanitizeSearch("(),")).toBeNull();
    expect(sanitizeSearch(undefined)).toBeNull();
  });
});

describe("cursor", () => {
  const c = { created_at: "2026-10-06T12:00:00.123456+00:00", id: "9f3e1b2c-1111-4000-8000-000000000001" };
  it("ida e volta", () => {
    expect(decodeSubscriberCursor(encodeSubscriberCursor(c))).toEqual(c);
  });
  it("recusa cursor com payload de injeção", () => {
    const evil = Buffer.from(
      JSON.stringify({ created_at: "2026-01-01),plan.eq.pro", id: c.id }),
    ).toString("base64url");
    expect(decodeSubscriberCursor(evil)).toBeNull();
    expect(decodeSubscriberCursor("lixo")).toBeNull();
  });
});

describe("pickOwners / countMembers", () => {
  const rows: MembershipLite[] = [
    { organization_id: "o1", user_id: "late", role: "admin", accepted_at: "2026-05-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" },
    { organization_id: "o1", user_id: "first", role: "admin", accepted_at: "2026-02-01T00:00:00Z", created_at: "2026-02-01T00:00:00Z" },
    { organization_id: "o1", user_id: "agent", role: "agent", accepted_at: "2025-01-01T00:00:00Z", created_at: "2025-01-01T00:00:00Z" },
    { organization_id: "o2", user_id: "viewer", role: "viewer", accepted_at: null, created_at: "2026-01-01T00:00:00Z" },
  ];
  it("dono é o admin mais antigo; org sem admin não tem dono", () => {
    const owners = pickOwners(rows);
    expect(owners.get("o1")).toBe("first");
    expect(owners.has("o2")).toBe(false);
  });
  it("conta membros por org", () => {
    const counts = countMembers(rows);
    expect(counts.get("o1")).toBe(3);
    expect(counts.get("o2")).toBe(1);
  });
});
