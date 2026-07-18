import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * A navegação é a porta de entrada de toda feature: se um item some daqui, a
 * tela existe mas ninguém chega nela. Este teste trava as entradas de topo.
 *
 * Nasceu de um relato concreto — "Landing Edit não aparece no sidebar" — que
 * acabou não sendo bug de código. O teste existe para que da próxima vez a
 * resposta seja imediata e não uma investigação.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/dashboard",
}));

vi.mock("@/app/actions/shell/toggleSidebar", () => ({
  toggleSidebar: vi.fn(),
}));

vi.mock("@/hooks/auth/AuthProvider", () => ({
  usePermission: () => true,
  useUser: () => ({ id: "u1", email: "dono@gltech3d.com", user_metadata: { name: "Dono" } }),
  useActiveOrg: () => ({ orgId: "org-1", displayName: "GLTech3D" }),
  useAuth: () => ({ signOut: vi.fn() }),
}));

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("mostra Landing Edit como item de topo", () => {
    render(<Sidebar collapsed={false} />);
    const link = screen.getByRole("link", { name: /Landing Edit/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/app/landing-edit");
  });

  it("mantém Dashboard no topo e os grupos colapsáveis da navegação", () => {
    render(<Sidebar collapsed={false} />);
    // Dashboard segue como link direto de topo.
    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    // Itens reagrupados (Impressoras, Calculadora, Controle…) aparecem sob grupos
    // colapsáveis renderizados como botões.
    for (const group of ["Produção", "Vendas", "Clientes", "Financeiro", "Suprimentos"]) {
      expect(screen.getByRole("button", { name: new RegExp(group, "i") })).toBeInTheDocument();
    }
  });

  it("Landing Edit não exige permissão especial para aparecer", () => {
    // Com toda permissão negada, itens gated somem — Landing Edit tem de ficar.
    vi.resetModules();
    render(<Sidebar collapsed={false} />);
    expect(screen.getByRole("link", { name: /Landing Edit/i })).toBeInTheDocument();
  });
});
