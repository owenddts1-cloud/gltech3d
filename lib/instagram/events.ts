/**
 * Normalização dos eventos do webhook da Meta.
 *
 * O payload da Meta é aninhado, polimórfico e muda de forma conforme o produto
 * (`instagram`, `messenger`). Deixar cada consumidor cavar `entry[0].changes[0]
 * .value.from.id` é como um `.replace()` em campo nulo derruba três telas de uma
 * vez — foi o que aconteceu neste projeto com o CSV de vendas.
 *
 * Aqui o payload vira uma lista plana de eventos com forma fixa, e **tudo que
 * falta vira `null` em vez de exceção**: a Meta entrega campo opcional o tempo
 * todo, e um evento malformado não pode derrubar o lote inteiro.
 *
 * MÓDULO PURO: sem rede, sem banco. É o que permite testar contra payload real
 * sem ter app na Meta.
 */

export type InstagramEventKind = "comment" | "message" | "story_mention" | "unknown";

export interface InstagramEvent {
  kind: InstagramEventKind;
  /** Id do evento na Meta. Chave de idempotência — a Meta reenvia. */
  externalId: string | null;
  /** Conta do negócio que recebeu (o `ig_user_id` do perfil). */
  recipientIgId: string | null;
  /** Quem gerou: comentou, mandou DM, mencionou. */
  senderIgId: string | null;
  senderUsername: string | null;
  text: string | null;
  /** Post/Reel onde o comentário aconteceu. Nulo em DM. */
  mediaId: string | null;
  mediaUrl: string | null;
  /** Milissegundos desde a época, quando a Meta informa. */
  timestamp: number | null;
  /** O objeto cru, para depurar sem precisar reproduzir o evento. */
  raw: unknown;
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : typeof v === "number" ? String(v) : null;

const obj = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Achata o payload em eventos.
 *
 * A Meta manda `entry[]`, e cada entrada traz `changes[]` (comentários, menções)
 * ou `messaging[]` (Direct). Os dois formatos convivem no mesmo POST.
 */
export function normalizeWebhookPayload(payload: unknown): InstagramEvent[] {
  const root = obj(payload);
  const out: InstagramEvent[] = [];

  for (const rawEntry of arr(root.entry)) {
    const entry = obj(rawEntry);
    // `entry.id` é a conta do negócio nos dois formatos.
    const accountId = str(entry.id);
    const entryTime = typeof entry.time === "number" ? entry.time : null;

    // ── Comentários e menções ──────────────────────────────────────────────
    for (const rawChange of arr(entry.changes)) {
      const change = obj(rawChange);
      const field = str(change.field);
      const value = obj(change.value);
      const from = obj(value.from);

      if (field === "comments") {
        out.push({
          kind: "comment",
          externalId: str(value.id),
          recipientIgId: accountId,
          senderIgId: str(from.id),
          senderUsername: str(from.username),
          text: str(value.text),
          mediaId: str(obj(value.media).id) ?? str(value.media_id),
          mediaUrl: null,
          timestamp: entryTime,
          raw: rawChange,
        });
        continue;
      }

      if (field === "mentions") {
        out.push({
          kind: "story_mention",
          externalId: str(value.comment_id) ?? str(value.media_id),
          recipientIgId: accountId,
          senderIgId: str(from.id),
          senderUsername: str(from.username),
          text: str(value.text),
          mediaId: str(value.media_id),
          mediaUrl: null,
          timestamp: entryTime,
          raw: rawChange,
        });
        continue;
      }

      out.push({
        kind: "unknown",
        externalId: null,
        recipientIgId: accountId,
        senderIgId: null,
        senderUsername: null,
        text: null,
        mediaId: null,
        mediaUrl: null,
        timestamp: entryTime,
        raw: rawChange,
      });
    }

    // ── Direct ─────────────────────────────────────────────────────────────
    for (const rawMsg of arr(entry.messaging)) {
      const m = obj(rawMsg);
      const message = obj(m.message);

      // `is_echo` marca a MENSAGEM QUE NÓS ENVIAMOS, devolvida pela Meta. Sem
      // ignorar, o robô responderia à própria resposta — laço infinito com custo
      // de IA a cada volta.
      if (message.is_echo === true) continue;

      const attachments = arr(message.attachments);
      const firstUrl = str(obj(obj(attachments[0]).payload).url);

      out.push({
        kind: "message",
        externalId: str(message.mid),
        recipientIgId: str(obj(m.recipient).id) ?? accountId,
        senderIgId: str(obj(m.sender).id),
        senderUsername: null, // a Meta não manda o handle aqui; resolve-se depois
        text: str(message.text),
        mediaId: null,
        mediaUrl: firstUrl,
        timestamp: typeof m.timestamp === "number" ? m.timestamp : entryTime,
        raw: rawMsg,
      });
    }
  }

  return out;
}

/**
 * O evento tem o mínimo para virar linha no banco?
 *
 * Sem `externalId` não há idempotência, e a Meta reenvia — gravaria duplicado a
 * cada reentrega. Sem remetente não há a quem responder.
 */
export function isActionable(e: InstagramEvent): boolean {
  return e.kind !== "unknown" && e.externalId !== null && e.senderIgId !== null;
}

/**
 * A janela de 24 horas da Meta.
 *
 * A política de mensagens permite responder até 24 h após a última mensagem DO
 * USUÁRIO. Passado isso, o envio é recusado pela API sem tag de agente humano —
 * e recusa da Meta vira mensagem "failed" no CRM sem explicação se ninguém
 * checou antes.
 *
 * O follow-up de carrinho abandonado que se costuma querer (2 h) cabe
 * folgadamente; reengajamento no dia seguinte não cabe.
 */
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinMessagingWindow(lastInboundAt: Date | null, now = new Date()): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() < MESSAGING_WINDOW_MS;
}
