import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/actions/shell/toggleSidebar", () => ({
  toggleSidebar: vi.fn(),
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn(), resolvedTheme: "light" }),
}));

let mockUser = {
  id: "u-client",
  email: "cliente@empresa.com",
  is_platform_admin: false,
  organizations: [{ organization_id: "org-1", organization_name: "Cliente Org", role: "admin" as const }],
};

vi.mock("@/hooks/auth/AuthProvider", () => ({
  usePermission: () => true,
  useUser: () => mockUser,
  useActiveOrg: () => ({ orgId: "org-1", name: "Cliente Org", role: "admin" }),
  useAuth: () => ({
    user: mockUser,
    activeOrg: { orgId: "org-1", name: "Cliente Org", role: "admin" },
    plan: null,
    isAuthenticated: true,
    refreshing: false,
    signOut: vi.fn(),
  }),
  usePlan: () => null,
}));

import { AppShell } from "@/app/app/_components/AppShell";

describe("AppShell client navigation resolution", () => {
  it("renders for non-admin client without passing nav prop (resolves client-side)", () => {
    mockUser = {
      id: "u-client",
      email: "cliente@empresa.com",
      is_platform_admin: false,
      organizations: [{ organization_id: "org-1", organization_name: "Cliente Org", role: "admin" }],
    };

    render(
      <AppShell sidebarCollapsed={false}>
        <div data-testid="content">Dashboard Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
    // Regular items are present
    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    // Restricted items are hidden for non-admin client
    expect(screen.queryByRole("link", { name: /Landing Edit/i })).not.toBeInTheDocument();
  });

  it("renders restricted items for platform admin / directorate user", () => {
    mockUser = {
      id: "u-admin",
      email: "diretoria@gltech3d.com.br",
      is_platform_admin: true,
      organizations: [{ organization_id: "org-1", organization_name: "GLTech Org", role: "admin" }],
    };

    render(
      <AppShell sidebarCollapsed={false}>
        <div data-testid="content">Admin Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Landing Edit/i })).toBeInTheDocument();
  });
});
