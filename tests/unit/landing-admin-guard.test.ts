import { describe, it, expect } from "vitest";
import { isLandingAdmin, isDirectorateEmail, assertLandingAdmin } from "@/lib/auth/landing-admin";
import type { AuthUser, ActiveOrg } from "@/lib/auth/types";

describe("landing-admin guard", () => {
  const directorUser: AuthUser = {
    id: "user-dir-1",
    email: "diretoria@gltech3d.com.br",
    full_name: "Diretoria GLTech3D",
    avatar_url: null,
    is_platform_admin: false,
    organizations: [],
  };

  const directorGmailUser: AuthUser = {
    id: "user-dir-2",
    email: "diretoria.gltech@gmail.com",
    full_name: "Diretoria Gmail",
    avatar_url: null,
    is_platform_admin: false,
    organizations: [],
  };

  const clientProUser: AuthUser = {
    id: "user-client-1",
    email: "cliente@outroprovedor.com",
    full_name: "Cliente Calc3D Pro",
    avatar_url: null,
    is_platform_admin: false,
    organizations: [],
  };

  const platformAdminUser: AuthUser = {
    id: "user-plat-1",
    email: "admin@plataforma.com",
    full_name: "Super Admin",
    avatar_url: null,
    is_platform_admin: true,
    organizations: [],
  };

  const landingOrg: ActiveOrg = {
    orgId: "org-gltech3d",
    name: "GLTech3D Oficial",
    role: "admin",
  };

  const clientOrg: ActiveOrg = {
    orgId: "org-client-1",
    name: "Oficina 3D do Cliente",
    role: "admin",
  };

  it("identifies directorate emails accurately", () => {
    expect(isDirectorateEmail("diretoria@gltech3d.com.br")).toBe(true);
    expect(isDirectorateEmail("diretoria.gltech@gmail.com")).toBe(true);
    expect(isDirectorateEmail("DIRETORIA.GLTECH@GMAIL.COM")).toBe(true);
    expect(isDirectorateEmail("cliente@outroprovedor.com")).toBe(false);
    expect(isDirectorateEmail(null)).toBe(false);
  });

  it("allows platform admins on any organization", () => {
    expect(isLandingAdmin({ user: platformAdminUser, activeOrg: clientOrg, activeOrgSlug: "cliente-org" })).toBe(true);
  });

  it("allows directorate email accounts with admin role", () => {
    expect(isLandingAdmin({ user: directorUser, activeOrg: landingOrg, activeOrgSlug: "gltech3d" })).toBe(true);
    expect(isLandingAdmin({ user: directorGmailUser, activeOrg: landingOrg, activeOrgSlug: "gltech3d" })).toBe(true);
  });

  it("denies access to client PRO users even with role admin in their own org", () => {
    expect(
      isLandingAdmin({
        user: clientProUser,
        activeOrg: clientOrg,
        activeOrgSlug: "oficina-cliente",
      }),
    ).toBe(false);
  });

  it("denies access to non-admin members in landing org", () => {
    const viewerLandingOrg: ActiveOrg = {
      orgId: "org-gltech3d",
      name: "GLTech3D Oficial",
      role: "viewer",
    };
    expect(
      isLandingAdmin({
        user: clientProUser,
        activeOrg: viewerLandingOrg,
        activeOrgSlug: "gltech3d",
      }),
    ).toBe(false);
  });

  it("assertLandingAdmin throws 403 Forbidden for unauthorized users", () => {
    expect(() =>
      assertLandingAdmin({
        user: clientProUser,
        activeOrg: clientOrg,
        activeOrgSlug: "oficina-cliente",
      }),
    ).toThrow("403 Forbidden");
  });
});
