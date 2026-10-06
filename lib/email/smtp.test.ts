/**
 * A nova tentativa do SMTP.
 *
 * Nasceu de uma falha real na configuração da Brevo: `smtp-relay.brevo.com`
 * resolveu para um servidor que não respondeu (`connect ETIMEDOUT`), e a
 * tentativa seguinte entregou. Sem retry, o cliente perderia o link de ativação
 * por um soluço de rede.
 *
 * O outro lado importa tanto quanto: erro de AUTENTICAÇÃO não pode ser repetido
 * — não melhora, e martelar o servidor com senha errada pode bloquear a conta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMail = vi.fn();
const close = vi.fn();
const createTransport = vi.fn(() => ({ sendMail, close }));

vi.mock("nodemailer", () => ({ default: { createTransport } }));

const ARGS = { to: "cliente@exemplo.com", subject: "Oi", html: "<p>Oi</p>" };
const SNAPSHOT = { ...process.env };

function erro(code: string, message = code): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.SMTP_HOST = "smtp-relay.brevo.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "login@smtp-brevo.com";
  process.env.SMTP_PASSWORD = "chave";
});

afterEach(() => {
  process.env = { ...SNAPSHOT };
});

async function carregar() {
  return import("./smtp");
}

describe("isTransientSmtpError", () => {
  it.each(["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "ESOCKET", "ECONNECTION", "EDNS"])(
    "%s é falha de rede",
    async (code) => {
      const { isTransientSmtpError } = await carregar();
      expect(isTransientSmtpError(erro(code))).toBe(true);
    },
  );

  it.each(["EAUTH", "EENVELOPE", "EMESSAGE", undefined])("%s não é", async (code) => {
    const { isTransientSmtpError } = await carregar();
    const e = code ? erro(code) : new Error("sem código");
    expect(isTransientSmtpError(e)).toBe(false);
  });

  it("não quebra com valor que não é erro", async () => {
    const { isTransientSmtpError } = await carregar();
    expect(isTransientSmtpError(null)).toBe(false);
    expect(isTransientSmtpError("ETIMEDOUT")).toBe(false);
  });
});

describe("sendViaSmtp — nova tentativa", () => {
  it("o caso real: timeout na primeira, entrega na segunda", async () => {
    sendMail
      .mockRejectedValueOnce(erro("ETIMEDOUT", "connect ETIMEDOUT 1.179.117.1:587"))
      .mockResolvedValueOnce({ messageId: "<ok@brevo>" });
    const { sendViaSmtp } = await carregar();

    const res = await sendViaSmtp(ARGS);

    expect(res).toEqual({ ok: true, id: "<ok@brevo>" });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("recria o transporte entre as tentativas, para cair em outro servidor", async () => {
    sendMail.mockRejectedValueOnce(erro("ETIMEDOUT")).mockResolvedValueOnce({ messageId: "x" });
    const { sendViaSmtp } = await carregar();

    await sendViaSmtp(ARGS);

    expect(close).toHaveBeenCalledOnce();
    expect(createTransport).toHaveBeenCalledTimes(2);
  });

  it("NÃO repete erro de autenticação", async () => {
    sendMail.mockRejectedValue(erro("EAUTH", "535 Authentication failed"));
    const { sendViaSmtp } = await carregar();

    const res = await sendViaSmtp(ARGS);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("send_failed");
  });

  it("desiste depois de duas falhas de rede, sem laço infinito", async () => {
    sendMail.mockRejectedValue(erro("ETIMEDOUT"));
    const { sendViaSmtp } = await carregar();

    const res = await sendViaSmtp(ARGS);

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(res.ok).toBe(false);
  });

  it("mapeia estouro de cota para rate_limited", async () => {
    sendMail.mockRejectedValue(erro("EMESSAGE", "Daily sending quota exceeded"));
    const { sendViaSmtp } = await carregar();

    const res = await sendViaSmtp(ARGS);

    expect(res.error).toBe("rate_limited");
  });

  it("sem configuração não tenta conectar", async () => {
    delete process.env.SMTP_PASSWORD;
    const { sendViaSmtp } = await carregar();

    const res = await sendViaSmtp(ARGS);

    expect(res).toEqual({ ok: false, error: "not_configured" });
    expect(createTransport).not.toHaveBeenCalled();
  });
});

describe("configuração do transporte", () => {
  it("587 usa STARTTLS (secure=false); 465 usa TLS direto", async () => {
    sendMail.mockResolvedValue({ messageId: "x" });
    let mod = await carregar();
    await mod.sendViaSmtp(ARGS);
    expect(createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ port: 587, secure: false }),
    );

    vi.resetModules();
    process.env.SMTP_PORT = "465";
    mod = await carregar();
    await mod.sendViaSmtp(ARGS);
    expect(createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it("tem timeout de conexão — sem ele uma função serverless seria cortada esperando", async () => {
    sendMail.mockResolvedValue({ messageId: "x" });
    const { sendViaSmtp } = await carregar();
    await sendViaSmtp(ARGS);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ connectionTimeout: 10_000 }),
    );
  });
});
