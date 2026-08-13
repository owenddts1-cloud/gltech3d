/**
 * Cliente da Meta Graph API para Instagram.
 *
 * Camada fina de propósito: monta a URL, manda, e traduz o erro da Meta para
 * algo acionável. Toda decisão de negócio (que regra casou, se cabe na janela de
 * 24 h, qual template usar) fica fora — em módulo puro e testável.
 *
 * O TOKEN NUNCA APARECE EM LOG. Ele vai no corpo ou no cabeçalho, nunca em query
 * string, e as mensagens de erro deste arquivo jamais o incluem. Um token de
 * Página publica e manda DM em nome do negócio; vazá-lo num log de erro é o tipo
 * de defeito que só se descobre depois.
 *
 * ERRO DA META É INFORMATIVO, NÃO GENÉRICO. A API devolve `error.code` e
 * `error.error_subcode` que dizem coisas muito diferentes — token expirado,
 * permissão faltando, janela de 24 h fechada, rate limit. Colapsar tudo em
 * "falha ao enviar" faz o operador reenviar para sempre uma mensagem que a Meta
 * nunca vai aceitar.
 */

import { env } from "@/lib/env";

const GRAPH = "https://graph.facebook.com";

export interface MetaErrorInfo {
  /** Código numérico da Meta. */
  code: number | null;
  subcode: number | null;
  message: string;
  /** Reenviar adianta? `false` para erro de permissão, token ou janela. */
  retryable: boolean;
  /** O que fazer, em português, para a tela poder mostrar. */
  hint: string;
}

export class MetaApiError extends Error {
  readonly info: MetaErrorInfo;
  constructor(info: MetaErrorInfo) {
    super(info.message);
    this.name = "MetaApiError";
    this.info = info;
  }
}

/**
 * Traduz o erro da Meta.
 *
 * Os códigos abaixo são os que mudam a conduta do sistema. Qualquer outro entra
 * como reenviável — errar para o lado de tentar de novo é melhor que descartar
 * silenciosamente uma mensagem de cliente.
 */
export function interpretMetaError(status: number, body: unknown): MetaErrorInfo {
  const error =
    typeof body === "object" && body !== null && "error" in body
      ? ((body as { error: Record<string, unknown> }).error ?? {})
      : {};

  const code = typeof error.code === "number" ? error.code : null;
  const subcode = typeof error.error_subcode === "number" ? error.error_subcode : null;
  const message =
    typeof error.message === "string" ? error.message : `HTTP ${status} sem detalhe da Meta`;

  // 190: token inválido ou expirado. Reenviar nunca resolve — precisa reconectar.
  if (code === 190) {
    return { code, subcode, message, retryable: false,
      hint: "Token expirado ou revogado. Reconecte a conta do Instagram." };
  }
  // 200 / 10: permissão ausente. Depende de App Review, não de tentar de novo.
  if (code === 200 || code === 10) {
    return { code, subcode, message, retryable: false,
      hint: "Falta permissão no app da Meta. Verifique o App Review das permissões de mensagem e comentário." };
  }
  // 551 / 10 subcode 2534022: fora da janela de 24 h.
  if (code === 551 || subcode === 2534022) {
    return { code, subcode, message, retryable: false,
      hint: "Fora da janela de 24 horas: só é possível responder até 24 h após a última mensagem do cliente." };
  }
  // 4, 17, 32, 613: limite de chamadas. Reenviar depois resolve.
  if (code !== null && [4, 17, 32, 613].includes(code)) {
    return { code, subcode, message, retryable: true,
      hint: "Limite de chamadas da Meta atingido. O envio será tentado de novo." };
  }
  // 5xx da Meta: instabilidade dela.
  if (status >= 500) {
    return { code, subcode, message, retryable: true,
      hint: "Instabilidade na Meta. O envio será tentado de novo." };
  }

  return { code, subcode, message, retryable: status >= 500,
    hint: "Erro da Meta não classificado. Veja a mensagem original." };
}

interface CallOptions {
  path: string;
  accessToken: string;
  body?: Record<string, unknown>;
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string>;
}

async function call<T>({ path, accessToken, body, method = "POST", query }: CallOptions): Promise<T> {
  const version = env.META_GRAPH_VERSION || "v21.0";
  const url = new URL(`${GRAPH}/${version}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method,
    headers: {
      // Token no CABEÇALHO. Em query string ele apareceria em log de proxy, de
      // CDN e no histórico de qualquer ferramenta de rede.
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Resposta não-JSON da Meta acontece em erro de gateway. Segue para a
    // interpretação com o corpo nulo.
  }

  if (!res.ok) throw new MetaApiError(interpretMetaError(res.status, parsed));
  return parsed as T;
}

/** Envia DM. `igUserId` é a conta do NEGÓCIO; `recipientId`, o cliente. */
export function sendDirectMessage(args: {
  igUserId: string;
  recipientId: string;
  accessToken: string;
  text: string;
  /** Botões de resposta rápida. A Meta limita a 13; cortamos antes de mandar. */
  quickReplies?: Array<{ title: string; payload: string }>;
}): Promise<{ message_id?: string; recipient_id?: string }> {
  const quick = (args.quickReplies ?? []).slice(0, 13).map((q) => ({
    content_type: "text",
    // A Meta corta o título em 20 caracteres. Cortar aqui evita a surpresa de a
    // legenda aparecer truncada no celular do cliente.
    title: q.title.slice(0, 20),
    payload: q.payload.slice(0, 1000),
  }));

  return call({
    path: `${args.igUserId}/messages`,
    accessToken: args.accessToken,
    body: {
      recipient: { id: args.recipientId },
      message: {
        text: args.text.slice(0, 1000),
        ...(quick.length > 0 ? { quick_replies: quick } : {}),
      },
    },
  });
}

/**
 * Responde publicamente a um comentário.
 *
 * É o "te mandei no direct 😉" — que além de avisar o cliente, movimenta o post
 * no algoritmo do Instagram.
 */
export function replyToComment(args: {
  commentId: string;
  accessToken: string;
  message: string;
}): Promise<{ id?: string }> {
  return call({
    path: `${args.commentId}/replies`,
    accessToken: args.accessToken,
    body: { message: args.message.slice(0, 2200) },
  });
}

/** Oculta ou revela um comentário. Moderação sem apagar. */
export function setCommentHidden(args: {
  commentId: string;
  accessToken: string;
  hide: boolean;
}): Promise<{ success?: boolean }> {
  return call({
    path: args.commentId,
    accessToken: args.accessToken,
    body: { hide: args.hide },
  });
}

/** Apaga um comentário. Irreversível — a moderação deve preferir ocultar. */
export function deleteComment(args: {
  commentId: string;
  accessToken: string;
}): Promise<{ success?: boolean }> {
  return call({ path: args.commentId, accessToken: args.accessToken, method: "DELETE" });
}

/** Perfil de quem escreveu, para a conversa não ficar com um id numérico. */
export function fetchUserProfile(args: {
  igScopedUserId: string;
  accessToken: string;
}): Promise<{ name?: string; username?: string; profile_pic?: string }> {
  return call({
    path: args.igScopedUserId,
    accessToken: args.accessToken,
    method: "GET",
    query: { fields: "name,username,profile_pic" },
  });
}

// ── Publicação, em duas etapas ───────────────────────────────────────────────
//
// A Meta exige criar o CONTÊINER primeiro e publicar depois. As duas etapas
// ficam separadas aqui de propósito: se a publicação falhar, o contêiner já
// criado é reaproveitado no reenvio em vez de subir a mídia de novo.

export function createMediaContainer(args: {
  igUserId: string;
  accessToken: string;
  /** URL pública da mídia. A Meta baixa por conta dela — não aceita upload direto. */
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO" | "REELS" | "STORIES" | "CAROUSEL";
  caption?: string;
  coverUrl?: string;
  /** Itens do carrossel, já criados como contêineres filhos. */
  children?: string[];
  isCarouselItem?: boolean;
}): Promise<{ id: string }> {
  const body: Record<string, unknown> = {};

  if (args.mediaType === "CAROUSEL") {
    body.media_type = "CAROUSEL";
    body.children = args.children ?? [];
  } else if (args.mediaType === "IMAGE") {
    body.image_url = args.mediaUrl;
    if (args.isCarouselItem) body.is_carousel_item = true;
  } else {
    body.media_type = args.mediaType;
    body.video_url = args.mediaUrl;
    if (args.coverUrl) body.cover_url = args.coverUrl;
    if (args.isCarouselItem) body.is_carousel_item = true;
  }

  if (args.caption && !args.isCarouselItem) body.caption = args.caption.slice(0, 2200);

  return call({ path: `${args.igUserId}/media`, accessToken: args.accessToken, body });
}

export function publishMediaContainer(args: {
  igUserId: string;
  accessToken: string;
  creationId: string;
}): Promise<{ id: string }> {
  return call({
    path: `${args.igUserId}/media_publish`,
    accessToken: args.accessToken,
    body: { creation_id: args.creationId },
  });
}

/**
 * Estado do contêiner.
 *
 * Vídeo e Reel levam tempo para a Meta processar. Publicar antes de `FINISHED`
 * devolve erro — e o agendador precisa esperar, não desistir.
 */
export function fetchContainerStatus(args: {
  containerId: string;
  accessToken: string;
}): Promise<{ status_code?: string; status?: string }> {
  return call({
    path: args.containerId,
    accessToken: args.accessToken,
    method: "GET",
    query: { fields: "status_code,status" },
  });
}
