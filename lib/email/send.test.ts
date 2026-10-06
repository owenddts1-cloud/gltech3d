/**
 * A escolha do transporte.
 *
 * O erro caro aqui é silencioso: com SMTP e Resend configurados ao mesmo tempo,
 * cair no Resend significa que **o cliente nunca recebe o e-mail** — o Resend
 * sem domínio verificado só entrega no dono da conta. O sintoma é "paguei e não
 * chegou nada", e a causa não aparece em log nenhum.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const sendViaSmtp = vi.fn();
const batchViaSmtp = vi.fn();
const sendViaResend = vi.fn();
const batchViaResend = vi.fn();

// Os mocks leem a env no momento da chamada, igual aos módulos reais — é o que
// permite trocar a configuração entre os testes.
vi.mock("./smtp", () => ({
  isSmtpConfigured: () =>
    Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  sendViaSmtp: (...a: unknown[]) => sendViaSmtp(...a),
  batchViaSmtp: (...a: unknown[]) => batchViaSmtp(...a),
}));

vi.mock("./resend", () => ({
  isResendConfigured: () => Boolean(process.env.RESEND_API_KEY),
  sendViaResend: (...a: unknown[]) => sendViaResend(...a),
  batchViaResend: (...a: unknown[]) => batchViaResend(...a),
}));

import { sendEmail, sendBatchEmails, activeTransport, isEmailConfigured } from "./send";

const ARGS = { to: "cliente@exemplo.com", subject: "Oi", html: "<p>Oi</p>" };

function configurar(opts: { smtp?: boolean; resend?: boolean }) {
  if (opts.smtp) {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "dono@gmail.com";
    process.env.SMTP_PASSWORD = "senha-de-app";
  } else {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
  }
  if (opts.resend) process.env.RESEND_API_KEY = "re_chave_de_teste";
  else delete process.env.RESEND_API_KEY;
}

const SNAPSHOT = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  sendViaSmtp.mockResolvedValue({ ok: true, id: "smtp-1" });
  sendViaResend.mockResolvedValue({ ok: true, id: "resend-1" });
  batchViaSmtp.mockResolvedValue({ successCount: 1, results: [] });
  batchViaResend.mockResolvedValue({ successCount: 1, results: [] });
});

afterEach(() => {
  process.env = { ...SNAPSHOT };
});

describe("activeTransport", () => {
  it("só SMTP configurado → smtp", () => {
    configurar({ smtp: true });
    expect(activeTransport()).toBe("smtp");
  });

  it("só Resend configurado → resend", () => {
    configurar({ resend: true });
    expect(activeTransport()).toBe("resend");
  });

  it("os dois configurados → SMTP ganha", () => {
    configurar({ smtp: true, resend: true });
    expect(activeTransport()).toBe("smtp");
  });

  it("nenhum → none", () => {
    configurar({});
    expect(activeTransport()).toBe("none");
  });

  it("SMTP pela metade (sem senha) não conta como configurado", () => {
    configurar({ resend: true });
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "dono@gmail.com";
    // Sem SMTP_PASSWORD: tratar como válido faria todo envio falhar em runtime
    // em vez de cair para o Resend.
    expect(activeTransport()).toBe("resend");
  });
});

describe("sendEmail", () => {
  it("usa o SMTP quando ele está disponível", async () => {
    configurar({ smtp: true, resend: true });
    const res = await sendEmail(ARGS);
    expect(sendViaSmtp).toHaveBeenCalledOnce();
    expect(sendViaResend).not.toHaveBeenCalled();
    expect(res.id).toBe("smtp-1");
  });

  it("cai para o Resend quando não há SMTP", async () => {
    configurar({ resend: true });
    const res = await sendEmail(ARGS);
    expect(sendViaResend).toHaveBeenCalledOnce();
    expect(sendViaSmtp).not.toHaveBeenCalled();
    expect(res.id).toBe("resend-1");
  });

  it("sem transporte devolve not_configured sem chamar ninguém", async () => {
    configurar({});
    const res = await sendEmail(ARGS);
    expect(res).toEqual({ ok: false, error: "not_configured" });
    expect(sendViaSmtp).not.toHaveBeenCalled();
    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it("repassa os argumentos sem alterar", async () => {
    configurar({ smtp: true });
    const completo = { ...ARGS, text: "Oi", replyTo: "r@x.com" };
    await sendEmail(completo);
    expect(sendViaSmtp).toHaveBeenCalledWith(completo);
  });
});

describe("sendBatchEmails", () => {
  it("segue o mesmo transporte do envio simples", async () => {
    configurar({ smtp: true, resend: true });
    await sendBatchEmails([ARGS]);
    expect(batchViaSmtp).toHaveBeenCalledOnce();
    expect(batchViaResend).not.toHaveBeenCalled();
  });

  it("sem transporte marca todos como não enviados, preservando o shape", async () => {
    configurar({});
    const res = await sendBatchEmails([ARGS, { ...ARGS, to: ["a@x.com", "b@x.com"] }]);
    expect(res.successCount).toBe(0);
    expect(res.results).toEqual([
      { email: "cliente@exemplo.com", success: false, error: "not_configured" },
      { email: "a@x.com,b@x.com", success: false, error: "not_configured" },
    ]);
  });
});

describe("isEmailConfigured", () => {
  it.each([
    [{ smtp: true }, true],
    [{ resend: true }, true],
    [{ smtp: true, resend: true }, true],
    [{}, false],
  ])("%o → %s", (cfg, esperado) => {
    configurar(cfg);
    expect(isEmailConfigured()).toBe(esperado);
  });
});
