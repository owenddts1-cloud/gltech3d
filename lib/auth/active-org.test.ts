import { describe, expect, it } from "vitest";
import { isMembershipUsable, pickActiveOrg, pickSelectedMembership } from "./active-org";
import type { AuthUser, UserOrgMembership } from "./types";

function membership(id: string, status: string | null, role: UserOrgMembership["role"] = "admin"): UserOrgMembership {
  return { organization_id: id, organization_name: `Org ${id}`, role, organization_status: status };
}

function user(organizations: UserOrgMembership[], isPlatformAdmin = false): AuthUser {
  return {
    id: "u1",
    email: "u@teste",
    full_name: null,
    avatar_url: null,
    is_platform_admin: isPlatformAdmin,
    organizations,
  };
}

describe("pickSelectedMembership", () => {
  it("prefers the cookie org when the user belongs to it", () => {
    const u = user([membership("a", "active"), membership("b", "active")]);
    expect(pickSelectedMembership(u, "b")?.organization_id).toBe("b");
  });

  it("ignores a cookie pointing at an org the user is not in", () => {
    const u = user([membership("a", "active")]);
    expect(pickSelectedMembership(u, "zzz")?.organization_id).toBe("a");
  });

  it("returns the selected org even when suspended (the shell needs it to redirect)", () => {
    const u = user([membership("a", null)]);
    expect(pickSelectedMembership(u, undefined)?.organization_id).toBe("a");
  });

  it("returns null without memberships", () => {
    expect(pickSelectedMembership(user([]), "a")).toBeNull();
  });
});

describe("pickActiveOrg (API handlers and server actions)", () => {
  it("resolves an active org", () => {
    const u = user([membership("a", "active", "manager")]);
    expect(pickActiveOrg(u, "a")).toEqual({ orgId: "a", name: "Org a", role: "manager" });
  });

  it("returns null for a suspended org", () => {
    const u = user([membership("a", "suspended")]);
    expect(pickActiveOrg(u, "a")).toBeNull();
  });

  it("returns null when the org row was hidden by RLS (status unknown)", () => {
    const u = user([membership("a", null)]);
    expect(pickActiveOrg(u, undefined)).toBeNull();
  });

  it("does NOT silently fall back to another org when the selected one is suspended", () => {
    const u = user([membership("a", "active"), membership("b", "suspended")]);
    expect(pickActiveOrg(u, "b")).toBeNull();
  });

  it("returns null for redacted and archived orgs too", () => {
    expect(pickActiveOrg(user([membership("a", "redacted")]), "a")).toBeNull();
    expect(pickActiveOrg(user([membership("a", "archived")]), "a")).toBeNull();
  });

  it("keeps platform admins operating on a suspended org", () => {
    const u = user([membership("a", "suspended")], true);
    expect(pickActiveOrg(u, "a")?.orgId).toBe("a");
    expect(isMembershipUsable(membership("a", "suspended"), u)).toBe(true);
  });
});
