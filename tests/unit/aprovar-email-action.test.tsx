import { afterEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { EmailActionRunner, toView } from "@/app/(public)/aprovar/[token]/_client";

/**
 * Scanners de e-mail (Defender Safe Links, Proofpoint, Mimecast) abrem os links
 * num navegador headless COM JavaScript. A página do botão "Aprovar e liberar"
 * NÃO pode decidir nada só por ter sido aberta: o POST sai apenas no clique.
 */

const PROPS = {
  token: "body.sig",
  action: "approve" as const,
  signupId: "9f3e1b2c-1111-4000-8000-000000000001",
  amountLabel: "R$ 197,00",
  buyerName: "Maria",
  buyerEmailMasked: "ma***@example.com",
};

function okResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EmailActionRunner", () => {
  it("abrir a página NÃO dispara o POST — só mostra o resumo e o botão", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailActionRunner {...PROPS} />);

    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("ma***@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar aprovação" })).toBeInTheDocument();
    // Dá ao React a chance de rodar qualquer efeito pendente.
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("o clique dispara exatamente um POST, sem cookie, mesmo com duplo clique", async () => {
    const fetchMock = vi.fn(async () =>
      okResponse({
        action: "approve",
        mode: "upgrade",
        organization_name: "Acme",
        plan_expires_at: "2027-10-06T12:00:00.000Z",
        email_dispatched: true,
        buyer_name: "Maria",
        buyer_phone: null,
        buyer_membership: "active_kept",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailActionRunner {...PROPS} />);
    const button = screen.getByRole("button", { name: "Confirmar aprovação" });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText(/PRO liberado para Acme/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(String(init.body))).toEqual({ token: "body.sig" });
  });

  it("recusa mostra o botão de confirmar recusa", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<EmailActionRunner {...PROPS} action="reject" />);
    expect(screen.getByRole("button", { name: "Confirmar recusa" })).toBeInTheDocument();
  });
});

describe("toView", () => {
  it("CREATE com conta existente não traz link de ativação", () => {
    const v = toView(200, {
      data: {
        action: "approve",
        mode: "create",
        organization_name: "Acme",
        plan_expires_at: "2027-10-06T12:00:00.000Z",
        email_dispatched: true,
        buyer_name: "Maria",
        buyer_phone: null,
        existing_account: true,
        activation_url: null,
        activation_expires_at: null,
      },
    });
    expect(v.kind).toBe("create");
    if (v.kind === "create") {
      expect(v.data.existing_account).toBe(true);
      expect(v.data.activation_url).toBeNull();
    }
  });

  it("mapeia os erros conhecidos", () => {
    expect(toView(409, { error: { code: "already_decided" } }).kind).toBe("already_decided");
    expect(toView(409, { error: { code: "ambiguous_org" } }).kind).toBe("ambiguous");
    expect(toView(410, { error: { code: "token_expired" } }).kind).toBe("expired");
    expect(toView(400, { error: { code: "invalid_token" } }).kind).toBe("invalid");
    expect(toView(502, null)).toEqual({ kind: "error", message: "Erro 502" });
  });
});
