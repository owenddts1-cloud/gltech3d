import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppSwitcherDashboard from "@/app/portal/switcher/page";
import type { AuthUser } from "@/lib/auth/types";

// Mock hooks
let mockUser: AuthUser = {
  id: "test-user-id",
  email: "cliente@outroprovedor.com",
  full_name: "Cliente Comum",
  avatar_url: null,
  is_platform_admin: false,
  organizations: [],
};

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useUser: () => mockUser,
}));

describe("AppSwitcherDashboard", () => {
  it("renders coming-soon status for regular non-admin clients", () => {
    mockUser = {
      id: "client-id",
      email: "cliente@empresa.com",
      full_name: "Cliente Padrão",
      avatar_url: null,
      is_platform_admin: false,
      organizations: [],
    };

    render(<AppSwitcherDashboard />);

    expect(screen.getByText("CRM")).toBeDefined();
    expect(screen.getByText("Automações (n8n)")).toBeDefined();
    expect(screen.getByText("Criação de Conteúdo")).toBeDefined();

    const emConstrucaoBadges = screen.getAllByText("Em construção");
    expect(emConstrucaoBadges.length).toBe(2);

    expect(screen.queryByText("Acesso Diretoria")).toBeNull();
  });

  it("unlocks all 3 workspaces as available for directorate and platform admin users", () => {
    mockUser = {
      id: "admin-id",
      email: "diretoria@gltech3d.com.br",
      full_name: "Diretoria GLTech3D",
      avatar_url: null,
      is_platform_admin: true,
      organizations: [],
    };

    render(<AppSwitcherDashboard />);

    expect(screen.getByText("Acesso Diretoria")).toBeDefined();

    // All 3 should now be 'Disponível'
    const disponivelBadges = screen.getAllByText("Disponível");
    expect(disponivelBadges.length).toBe(3);

    // No 'Em construção'
    expect(screen.queryByText("Em construção")).toBeNull();

    // All action links say 'Acessar Workspace'
    const accessWorkspaceButtons = screen.getAllByText("Acessar Workspace");
    expect(accessWorkspaceButtons.length).toBe(3);

    // Check link destinations
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/app/dashboard");
    expect(hrefs).toContain("/app/automations");
    expect(hrefs).toContain("/content-studio/timeline");
  });
});
