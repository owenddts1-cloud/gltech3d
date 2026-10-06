import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Role } from "@/lib/auth/types";
import { roleCan } from "@/lib/auth/permissions";

/**
 * Menu items whose page redirects to /403 for the current role must not be
 * shown. The mock below routes `usePermission` through the REAL permission map
 * (`lib/auth/permissions.ts`), so this test fails if the map drifts from the
 * page guards (tenant/connections = admin, AI agents = manager).
 */

let currentRole: Role = "viewer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/dashboard",
}));

vi.mock("@/app/actions/shell/toggleSidebar", () => ({
  toggleSidebar: vi.fn(),
}));

// "Conexões" carries a live health dot backed by react-query; it is irrelevant
// to role filtering, so it is stubbed instead of wrapping a QueryClient.
vi.mock("@/components/connections/ConnectionHealthDot", () => ({
  ConnectionHealthDot: () => null,
}));

vi.mock("@/hooks/auth/AuthProvider", () => ({
  usePermission: (action: string) => roleCan(currentRole, action),
  useUser: () => ({ id: "u1", email: "membro@gltech3d.com", full_name: null, avatar_url: null }),
  useActiveOrg: () => ({ orgId: "org-1", name: "GLTech3D", role: currentRole }),
  useAuth: () => ({ signOut: vi.fn() }),
  usePlan: () => null,
}));

import { Sidebar } from "./Sidebar";
import { CRM_NAV } from "./nav-crm";

function renderAs(role: Role) {
  currentRole = role;
  const view = render(<Sidebar collapsed={false} nav={CRM_NAV} />);
  // Groups start collapsed; open the ones holding gated items.
  fireEvent.click(screen.getByRole("button", { name: /Produção/i }));
  fireEvent.click(screen.getByRole("button", { name: /Clientes/i }));
  return view;
}

function hasLink(name: RegExp): boolean {
  return screen.queryByRole("link", { name }) !== null;
}

describe("Sidebar — filtro por papel", () => {
  it("agent não vê Organização, Conexões, LGPD nem Agentes IA", () => {
    renderAs("agent");
    expect(hasLink(/Organização/i)).toBe(false);
    expect(hasLink(/Conexões/i)).toBe(false);
    expect(hasLink(/LGPD/i)).toBe(false);
    expect(hasLink(/Agentes IA/i)).toBe(false);
    // Ungated items in the same groups stay visible.
    expect(hasLink(/Contatos/i)).toBe(true);
    expect(hasLink(/Ordens de Serviço/i)).toBe(true);
  });

  it("manager vê Agentes IA, mas não Organização nem Conexões", () => {
    renderAs("manager");
    expect(hasLink(/Agentes IA/i)).toBe(true);
    expect(hasLink(/Organização/i)).toBe(false);
    expect(hasLink(/Conexões/i)).toBe(false);
  });

  it("admin vê todos os itens restritos", () => {
    renderAs("admin");
    expect(hasLink(/Organização/i)).toBe(true);
    expect(hasLink(/Conexões/i)).toBe(true);
    expect(hasLink(/LGPD/i)).toBe(true);
    expect(hasLink(/Agentes IA/i)).toBe(true);
  });
});

describe("roleCan", () => {
  it("nega ação desconhecida (fail closed)", () => {
    expect(roleCan("admin", "acao.que.nao.existe")).toBe(false);
  });

  it("platform admin passa em tudo que é conhecido ou não", () => {
    expect(roleCan(null, "org.settings.manage", { isPlatformAdmin: true })).toBe(true);
  });

  it("sem papel, nega", () => {
    expect(roleCan(null, "inbox.view")).toBe(false);
  });
});
