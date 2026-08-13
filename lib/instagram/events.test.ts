/**
 * Normalização dos eventos da Meta.
 *
 * Os payloads abaixo seguem a forma documentada do webhook do Instagram. Como
 * não há app na Meta para receber evento real, eles são o contrato: se a forma
 * mudar, é aqui que se atualiza — e o resto do sistema não precisa saber.
 */

import { describe, expect, it } from "vitest";

import {
  isActionable,
  isWithinMessagingWindow,
  normalizeWebhookPayload,
  MESSAGING_WINDOW_MS,
} from "./events";

const COMENTARIO = {
  object: "instagram",
  entry: [
    {
      id: "17841400000000000",
      time: 1712345678,
      changes: [
        {
          field: "comments",
          value: {
            id: "17900000000000001",
            text: "PRECO",
            from: { id: "78901234", username: "cliente_teste" },
            media: { id: "17800000000000002", media_product_type: "REELS" },
          },
        },
      ],
    },
  ],
};

const DIRECT = {
  object: "instagram",
  entry: [
    {
      id: "17841400000000000",
      time: 1712345690,
      messaging: [
        {
          sender: { id: "78901234" },
          recipient: { id: "17841400000000000" },
          timestamp: 1712345690123,
          message: { mid: "mid.ABC123", text: "Essa case serve no Gol G3?" },
        },
      ],
    },
  ],
};

describe("comentário", () => {
  const [e] = normalizeWebhookPayload(COMENTARIO);

  it("extrai quem comentou, o quê e onde", () => {
    expect(e!.kind).toBe("comment");
    expect(e!.externalId).toBe("17900000000000001");
    expect(e!.senderIgId).toBe("78901234");
    expect(e!.senderUsername).toBe("cliente_teste");
    expect(e!.text).toBe("PRECO");
    expect(e!.mediaId).toBe("17800000000000002");
    expect(e!.recipientIgId).toBe("17841400000000000");
  });

  it("é acionável", () => {
    expect(isActionable(e!)).toBe(true);
  });
});

describe("Direct", () => {
  const [e] = normalizeWebhookPayload(DIRECT);

  it("extrai remetente, texto e id da mensagem", () => {
    expect(e!.kind).toBe("message");
    expect(e!.externalId).toBe("mid.ABC123");
    expect(e!.senderIgId).toBe("78901234");
    expect(e!.text).toContain("Gol G3");
    expect(e!.timestamp).toBe(1712345690123);
  });

  it("IGNORA eco — senão o robô responde à própria resposta", () => {
    // `is_echo` marca a mensagem que NÓS enviamos, devolvida pela Meta. Sem
    // filtrar, cada resposta geraria outra: laço infinito com custo de IA a cada
    // volta.
    const eco = {
      entry: [
        {
          id: "1784",
          messaging: [
            {
              sender: { id: "1784" },
              recipient: { id: "78901234" },
              message: { mid: "mid.ECO", text: "resposta do bot", is_echo: true },
            },
          ],
        },
      ],
    };
    expect(normalizeWebhookPayload(eco)).toEqual([]);
  });

  it("pega a URL do anexo quando não há texto", () => {
    const comAnexo = {
      entry: [
        {
          id: "1784",
          messaging: [
            {
              sender: { id: "789" },
              recipient: { id: "1784" },
              message: {
                mid: "mid.IMG",
                attachments: [{ type: "image", payload: { url: "https://cdn/x.jpg" } }],
              },
            },
          ],
        },
      ],
    };
    const [e] = normalizeWebhookPayload(comAnexo);
    expect(e!.mediaUrl).toBe("https://cdn/x.jpg");
    expect(e!.text).toBeNull();
  });
});

describe("robustez — campo que falta vira null, não exceção", () => {
  it("não quebra com payload vazio, nulo ou de outro formato", () => {
    for (const lixo of [null, undefined, {}, { entry: null }, { entry: [{}] }, "texto", 42]) {
      expect(() => normalizeWebhookPayload(lixo)).not.toThrow();
    }
    expect(normalizeWebhookPayload(null)).toEqual([]);
    expect(normalizeWebhookPayload({ entry: [{}] })).toEqual([]);
  });

  it("evento sem id externo NÃO é acionável — sem ele não há idempotência", () => {
    // A Meta reenvia o mesmo evento. Sem `externalId` a linha entraria duas
    // vezes, e a duplicata é invisível até alguém contar mensagens.
    const semId = { entry: [{ id: "1784", changes: [{ field: "comments", value: { text: "oi", from: { id: "1" } } }] }] };
    const [e] = normalizeWebhookPayload(semId);
    expect(e!.externalId).toBeNull();
    expect(isActionable(e!)).toBe(false);
  });

  it("evento sem remetente não é acionável — não há a quem responder", () => {
    const semFrom = { entry: [{ id: "1784", changes: [{ field: "comments", value: { id: "9", text: "oi" } }] }] };
    expect(isActionable(normalizeWebhookPayload(semFrom)[0]!)).toBe(false);
  });

  it("campo desconhecido vira 'unknown' em vez de sumir", () => {
    const novo = { entry: [{ id: "1784", changes: [{ field: "live_comments", value: {} }] }] };
    const [e] = normalizeWebhookPayload(novo);
    expect(e!.kind).toBe("unknown");
    expect(isActionable(e!)).toBe(false);
  });

  it("guarda o objeto cru, para depurar sem reproduzir o evento", () => {
    const [e] = normalizeWebhookPayload(COMENTARIO);
    expect(e!.raw).toBeDefined();
  });

  it("um POST com comentário E direct devolve os dois", () => {
    const misto = { entry: [COMENTARIO.entry[0], DIRECT.entry[0]] };
    const eventos = normalizeWebhookPayload(misto);
    expect(eventos.map((x) => x.kind).sort()).toEqual(["comment", "message"]);
  });
});

describe("janela de 24 horas da Meta", () => {
  it("dentro de 24 h pode responder", () => {
    const agora = new Date("2026-08-12T12:00:00Z");
    const duasHoras = new Date(agora.getTime() - 2 * 60 * 60 * 1000);
    expect(isWithinMessagingWindow(duasHoras, agora)).toBe(true);
  });

  it("passadas 24 h, NÃO pode — a API recusa", () => {
    // O follow-up de carrinho abandonado (2 h) cabe; reengajamento no dia
    // seguinte não cabe sem tag de agente humano. Descobrir isso na hora do
    // envio vira mensagem "failed" no CRM sem explicação.
    const agora = new Date("2026-08-12T12:00:00Z");
    const ontem = new Date(agora.getTime() - MESSAGING_WINDOW_MS - 1000);
    expect(isWithinMessagingWindow(ontem, agora)).toBe(false);
  });

  it("sem mensagem do usuário, não há janela", () => {
    expect(isWithinMessagingWindow(null)).toBe(false);
  });
});
