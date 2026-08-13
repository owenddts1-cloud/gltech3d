/**
 * Ingestão do Instagram: evento do webhook → contato, conversa e mensagem.
 *
 * É o que fecha a corrente da Etapa 1. O webhook só enfileira; aqui o evento
 * vira linha no CRM, e a partir daí o Inbox, o dispatcher de IA e a automação
 * enxergam Instagram exatamente como enxergam WhatsApp — porque é a MESMA tabela
 * `conversations`, destravada pela migration 0079.
 *
 * IDEMPOTÊNCIA. A Meta reenvia o mesmo evento sempre que a resposta não for 2xx,
 * e às vezes mesmo quando for. A proteção real é
 * `messages_org_external_id_unique` no banco: a segunda inserção devolve `23505`
 * e nós tratamos como sucesso. Conferir antes com um SELECT não bastaria — duas
 * entregas simultâneas passariam pelas duas checagens antes de qualquer INSERT.
 *
 * O ENVIO NÃO ACONTECE AQUI. Este handler grava e emite `instagram.message.ready`;
 * quem responde é o dispatcher de IA ou o motor de automação, cada um no seu
 * evento. Misturar ingestão com resposta faria uma falha de envio reprocessar a
 * gravação e duplicar a conversa.
 */

import type { EventHandler, EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

const KEY = "instagram-ingest";

/** Código do Postgres para violação de unicidade. */
const UNIQUE_VIOLATION = "23505";

interface EventoPayload {
  kind?: string;
  externalId?: string | null;
  senderIgId?: string | null;
  senderUsername?: string | null;
  text?: string | null;
  mediaId?: string | null;
  mediaUrl?: string | null;
  timestamp?: number | null;
  accountId?: string | null;
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

export const instagramIngestHandler: EventHandler = {
  key: KEY,
  events: ["instagram.comment", "instagram.message", "instagram.story_mention"],

  async handle(row: EventRow): Promise<HandlerResult> {
    const p = row.payload as EventoPayload;
    const externalId = str(p.externalId);
    const senderIgId = str(p.senderIgId);
    const accountId = str(p.accountId);

    if (!externalId || !senderIgId || !accountId) {
      // Evento sem o mínimo não é erro de execução: é evento que não dá para
      // processar. Marcar como `skipped` evita reprocessar para sempre.
      return { consumer_key: KEY, status: "skipped", detail: "evento sem id, remetente ou conta" };
    }

    const supabase = createAdminClient();
    const orgId = row.organization_id;

    // ── 1. Contato ────────────────────────────────────────────────────────
    //
    // Identidade do Instagram é o `senderIgId` (escopado ao app), não o @. O
    // handle muda quando a pessoa renomeia o perfil; o id não. Casar por @ faria
    // a mesma pessoa virar dois contatos depois de uma troca de nome.
    const handle = str(p.senderUsername);
    const displayName = handle ? `@${handle}` : `Instagram ${senderIgId.slice(-6)}`;

    const { data: contatoExistente } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("instagram_user_id", senderIgId)
      .maybeSingle();

    let contactId = (contatoExistente as { id: string } | null)?.id ?? null;

    if (!contactId) {
      const { data: novo, error } = await supabase
        .from("contacts")
        .insert({
          organization_id: orgId,
          name: displayName,
          instagram_user_id: senderIgId,
          instagram_username: handle,
          source: "instagram",
        })
        .select("id")
        .single();

      if (error) {
        // Corrida entre duas entregas simultâneas: a outra criou primeiro.
        if (error.code === UNIQUE_VIOLATION) {
          const { data: achado } = await supabase
            .from("contacts")
            .select("id")
            .eq("organization_id", orgId)
            .eq("instagram_user_id", senderIgId)
            .maybeSingle();
          contactId = (achado as { id: string } | null)?.id ?? null;
        }
        if (!contactId) {
          return { consumer_key: KEY, status: "error", detail: `contato: ${error.message}` };
        }
      } else {
        contactId = (novo as { id: string }).id;
      }
    } else if (handle) {
      // Handle mudou? Atualiza sem criar contato novo.
      await supabase
        .from("contacts")
        .update({ instagram_username: handle, updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("id", contactId)
        .neq("instagram_username", handle);
    }

    // ── 2. Conversa ───────────────────────────────────────────────────────
    const { data: convExistente } = await supabase
      .from("conversations")
      .select("id, last_inbound_at")
      .eq("organization_id", orgId)
      .eq("instagram_account_id", accountId)
      .eq("contact_id", contactId)
      .maybeSingle();

    let conversationId = (convExistente as { id: string } | null)?.id ?? null;
    const primeiraMensagem = conversationId === null;
    const quando = p.timestamp ? new Date(p.timestamp).toISOString() : new Date().toISOString();
    const preview = (str(p.text) ?? "(mídia)").slice(0, 160);

    if (!conversationId) {
      const { data: nova, error } = await supabase
        .from("conversations")
        .insert({
          organization_id: orgId,
          contact_id: contactId,
          instagram_account_id: accountId,
          // `channel_session_id` fica nulo: é do WhatsApp. A CHECK
          // `conversations_exactly_one_channel` da 0079 garante que exatamente
          // um dos dois esteja preenchido.
          channel: "instagram",
          status: "open",
          last_inbound_at: quando,
          last_message_at: quando,
          last_message_preview: preview,
        })
        .select("id")
        .single();
      if (error) return { consumer_key: KEY, status: "error", detail: `conversa: ${error.message}` };
      conversationId = (nova as { id: string }).id;
    } else {
      await supabase
        .from("conversations")
        .update({
          last_inbound_at: quando,
          last_message_at: quando,
          last_message_preview: preview,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    }

    // ── 3. Mensagem ───────────────────────────────────────────────────────
    const { error: erroMsg } = await supabase.from("messages").insert({
      organization_id: orgId,
      conversation_id: conversationId,
      external_id: externalId,
      direction: "inbound",
      type: p.mediaUrl ? "image" : "text",
      status: "received",
      body: str(p.text),
      media_url: str(p.mediaUrl),
      sent_via: "external_device",
      metadata: {
        source: "instagram",
        eventKind: p.kind ?? null,
        mediaId: str(p.mediaId),
        senderIgId,
      },
    });

    if (erroMsg) {
      // A REENTREGA DA META CAI AQUI, e é sucesso: a mensagem já está gravada.
      if (erroMsg.code === UNIQUE_VIOLATION) {
        return { consumer_key: KEY, status: "skipped", detail: "reentrega da Meta, ja gravada" };
      }
      return { consumer_key: KEY, status: "error", detail: `mensagem: ${erroMsg.message}` };
    }

    // ── 4. Avisa quem responde ────────────────────────────────────────────
    //
    // Evento separado de propósito: se o envio falhar, reprocessa só o envio —
    // não a gravação, que duplicaria a conversa.
    const { error: erroEvento } = await supabase.from("event_log").insert({
      organization_id: orgId,
      event_type: "instagram.message.ready",
      entity_kind: "conversation",
      entity_id: conversationId,
      payload: {
        conversationId,
        contactId,
        accountId,
        externalId,
        kind: p.kind ?? null,
        text: str(p.text),
        mediaId: str(p.mediaId),
        senderIgId,
        isFirstMessage: primeiraMensagem,
      },
    });

    if (erroEvento) {
      // A mensagem já está no CRM e visível no Inbox; só a resposta automática
      // não vai sair. Registrar e seguir é melhor que reprocessar tudo.
      logger.error("[instagram-ingest] falhou ao enfileirar a resposta", {
        conversationId,
        error: erroEvento.message,
      });
    }

    return { consumer_key: KEY, status: "ok", detail: primeiraMensagem ? "conversa nova" : "conversa existente" };
  },
};
