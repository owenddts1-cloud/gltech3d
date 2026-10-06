import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PlanState } from "@/lib/plan/types";

/**
 * O cadeado da navegação é o que o cliente VÊ quando o trial acaba — e é o que
 * leva à tela de upgrade. Se um item travado continuar apontando para a rota
 * real, a pessoa clica, o servidor redireciona e ela não entende o que houve.
 *
 * `Sidebar.test.tsx` cobre o caso `usePlan() === null` (não decora nada). Este
 * arquivo cobre os estados em que há plano resolvido.
 */

let currentPlan: PlanState | null = null;

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
  usePlan: () => currentPlan,
}));

import { Sidebar } from "./Sidebar";
import { CRM_NAV } from "./nav-crm";

function plan(over: Partial<PlanState>): PlanState {
  return {
    tier: "standard",
    status: "trial_expired",
    hasProAccess: false,
    trialDaysLeft: 0,
    trialEndsAt: null,
    planExpiresAt: null,
    ...over,
  };
}

function renderWith(p: PlanState | null) {
  currentPlan = p;
  return render(<Sidebar collapsed={false} nav={CRM_NAV} />);
}

describe("Sidebar — trial expirado", () => {
  it("manda item PRO para a tela de upgrade, com o módulo no parâmetro", () => {
    renderWith(plan({}));
    const link = screen.getByRole("link", { name: /Landing Edit/i });
    expect(link).toHaveAttribute(
      "href",
      `/app/settings/billing?locked=${encodeURIComponent("/app/landing-edit")}`,
    );
  });

  it("marca o item travado para teste e estilo", () => {
    renderWith(plan({}));
    expect(screen.getByRole("link", { name: /Landing Edit/i })).toHaveAttribute(
      "data-locked",
      "true",
    );
  });

  it("deixa Dashboard intacto — rota livre não trava", () => {
    renderWith(plan({}));
    const link = screen.getByRole("link", { name: /Dashboard/i });
    expect(link).toHaveAttribute("href", "/app/dashboard");
    expect(link).not.toHaveAttribute("data-locked");
  });

  it("o selo lê GRÁTIS", () => {
    renderWith(plan({}));
    expect(screen.getByText("GRÁTIS")).toBeInTheDocument();
  });
});

describe("Sidebar — trial em andamento", () => {
  it("não trava nada e mostra os dias restantes", () => {
    renderWith(plan({ status: "trialing", hasProAccess: true, trialDaysLeft: 5 }));
    expect(screen.getByRole("link", { name: /Landing Edit/i })).toHaveAttribute(
      "href",
      "/app/landing-edit",
    );
    expect(screen.getByText("TRIAL · 5 dias")).toBeInTheDocument();
  });

  it("concorda o plural no último dia", () => {
    renderWith(plan({ status: "trialing", hasProAccess: true, trialDaysLeft: 1 }));
    expect(screen.getByText("TRIAL · 1 dia")).toBeInTheDocument();
  });
});

describe("Sidebar — plano pago", () => {
  it("não trava nada e o selo lê PRO", () => {
    renderWith(plan({ tier: "pro", status: "active", hasProAccess: true, trialDaysLeft: null }));
    expect(screen.getByRole("link", { name: /Landing Edit/i })).toHaveAttribute(
      "href",
      "/app/landing-edit",
    );
    expect(screen.getByText("PRO")).toBeInTheDocument();
    expect(screen.queryByText("GRÁTIS")).not.toBeInTheDocument();
  });
});
