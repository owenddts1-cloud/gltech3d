import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionGlobalConfig } from "motion/react";

/**
 * Comportamento dos guias por tela: abrir sozinho na primeira visita sem
 * empilhar, lembrar o que foi visto, navegar pelos passos e sobreviver a um
 * localStorage bloqueado.
 */

let currentPath = "/app/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPath,
}));

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

import { GuideProvider, useGuides } from "./GuideProvider";
import { GuideButton } from "./GuideButton";

const KEY = "guides:v1:user-1";

function CenterOpener() {
  const { openCenter, resetAll } = useGuides();
  return (
    <>
      <button type="button" onClick={openCenter}>
        abrir central
      </button>
      <button type="button" onClick={resetAll}>
        rever tudo
      </button>
    </>
  );
}

function renderShell() {
  return render(
    <GuideProvider autoOpenDelayMs={0}>
      <GuideButton />
      <CenterOpener />
    </GuideProvider>,
  );
}

beforeAll(() => {
  // jsdom não anima: pula as transições para o exit terminar na hora.
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  currentPath = "/app/dashboard";
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GuideProvider", () => {
  it("primeira visita abre as boas-vindas; a tela só abre na próxima navegação", async () => {
    const user = userEvent.setup();
    const { rerender } = renderShell();

    const welcome = await screen.findByRole("dialog", { name: "Boas-vindas ao CRM" });
    expect(welcome).toHaveAttribute("aria-modal", "true");
    await user.click(within(welcome).getByRole("button", { name: "Entendi" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "[]")).toEqual(["welcome"]);

    // Mesma rota: o guia do Dashboard NÃO empilha logo depois das boas-vindas.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    currentPath = "/app/products";
    rerender(
      <GuideProvider autoOpenDelayMs={0}>
        <GuideButton />
        <CenterOpener />
      </GuideProvider>,
    );
    expect(await screen.findByRole("dialog", { name: "Produtos" })).toBeInTheDocument();
  });

  it("guia já visto não reabre sozinho, mas o botão do topo abre", async () => {
    window.localStorage.setItem(KEY, JSON.stringify(["welcome", "dashboard"]));
    const user = userEvent.setup();
    renderShell();

    const button = await screen.findByRole("button", { name: "Guia desta tela" });
    expect(screen.queryByTestId("guide-unseen-dot")).not.toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(button);
    expect(await screen.findByRole("dialog", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("mostra o ponto de novidade quando o guia da tela ainda não foi visto", async () => {
    window.localStorage.setItem(KEY, JSON.stringify(["welcome", "dashboard"]));
    currentPath = "/app/calendar";
    renderShell();
    await screen.findByRole("dialog", { name: "Calendário" });
    expect(screen.getByTestId("guide-unseen-dot")).toBeInTheDocument();
  });

  it("navega pelos passos com botões e setas do teclado", async () => {
    window.localStorage.setItem(KEY, JSON.stringify(["welcome"]));
    currentPath = "/app/service-orders";
    const user = userEvent.setup();
    renderShell();

    const dialog = await screen.findByRole("dialog", { name: "Ordens de Serviço" });
    expect(within(dialog).getByText("Passo 1 de 3")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Anterior/ })).toHaveAttribute("aria-disabled", "true");

    await user.click(within(dialog).getByRole("button", { name: /Próximo/ }));
    expect(within(dialog).getByText("Passo 2 de 3")).toBeInTheDocument();
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");

    await user.keyboard("{ArrowRight}");
    expect(within(dialog).getByText("Passo 3 de 3")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Próximo/ })).toHaveAttribute("aria-disabled", "true");

    await user.keyboard("{ArrowLeft}");
    expect(within(dialog).getByText("Passo 2 de 3")).toBeInTheDocument();

    const current = within(dialog)
      .getAllByRole("button")
      .find((b) => b.getAttribute("aria-current") === "step");
    expect(current).toHaveTextContent("Mova pelas colunas");
  });

  it("Esc fecha e marca o guia como visto", async () => {
    window.localStorage.setItem(KEY, JSON.stringify(["welcome"]));
    currentPath = "/app/team";
    const user = userEvent.setup();
    renderShell();

    await screen.findByRole("dialog", { name: "Equipe" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "[]")).toContain("team");
  });

  it("módulo de demonstração mostra o aviso no topo", async () => {
    window.localStorage.setItem(KEY, JSON.stringify(["welcome"]));
    currentPath = "/automations";
    renderShell();

    const dialog = await screen.findByRole("dialog", { name: "Automações" });
    const note = within(dialog).getByRole("note");
    expect(note).toHaveAttribute("data-kind", "demo");
    expect(note).toHaveTextContent("Demonstração");
  });

  it("Plano e cobrança nunca abre sozinho (a tela de upgrade tem a própria mensagem)", async () => {
    currentPath = "/app/settings/billing";
    renderShell();
    await screen.findByRole("button", { name: /Guia desta tela/ });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sem localStorage, o guia fechado não volta na mesma sessão", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const user = userEvent.setup();
    const { rerender } = renderShell();

    const welcome = await screen.findByRole("dialog", { name: "Boas-vindas ao CRM" });
    await user.click(within(welcome).getByRole("button", { name: "Entendi" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Navega para outra tela: abre o guia dela, não as boas-vindas de novo.
    currentPath = "/app/contacts";
    rerender(
      <GuideProvider autoOpenDelayMs={0}>
        <GuideButton />
        <CenterOpener />
      </GuideProvider>,
    );
    expect(await screen.findByRole("dialog", { name: "Contatos" })).toBeInTheDocument();
  });

  it("a central lista os guias por grupo com o estado de visto", async () => {
    window.localStorage.setItem(KEY, JSON.stringify(["welcome", "dashboard"]));
    const user = userEvent.setup();
    renderShell();

    await user.click(await screen.findByRole("button", { name: "abrir central" }));
    const center = await screen.findByRole("dialog", { name: "Central de guias" });
    expect(within(center).getByRole("region", { name: "Produção" })).toBeInTheDocument();
    expect(within(center).getByText(/2 de \d+ vistos/)).toBeInTheDocument();

    await user.click(within(center).getByRole("button", { name: "Abrir guia: Fornecedores" }));
    expect(await screen.findByRole("dialog", { name: "Fornecedores" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Central de guias" })).not.toBeInTheDocument();
  });

  it("rever todos os guias limpa o estado e reabre o guia da tela", async () => {
    window.localStorage.setItem(KEY, JSON.stringify(["welcome", "dashboard", "products"]));
    const user = userEvent.setup();
    renderShell();

    await user.click(await screen.findByRole("button", { name: "rever tudo" }));
    expect(await screen.findByRole("dialog", { name: "Dashboard" })).toBeInTheDocument();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
