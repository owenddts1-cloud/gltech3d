/**
 * Verificação da assinatura da Meta (`X-Hub-Signature-256`).
 *
 * POR QUE ISTO É O ARQUIVO MAIS IMPORTANTE DO MÓDULO. O webhook da Meta é uma
 * URL pública que aceita POST. Sem verificar a assinatura, qualquer um que
 * descubra o endereço injeta comentário, mensagem e menção falsos — e o robô
 * responde, o lead entra no CRM, a automação dispara DM. A assinatura é a única
 * coisa que separa "evento do Instagram" de "alguém mandando JSON".
 *
 * A Meta assina o **corpo cru** com HMAC SHA-256 usando o App Secret, e envia
 * `sha256=<hex>`. Reserializar o JSON antes de conferir quebra a comparação: a
 * ordem das chaves e o espaçamento mudam o byte, e o byte é o que foi assinado.
 * Por isso o handler tem de ler `await req.text()` e nunca `await req.json()`.
 *
 * Comparação em TEMPO CONSTANTE. `a === b` sai no primeiro byte diferente, e a
 * diferença de tempo entre "errou no primeiro caractere" e "errou no último"
 * permite descobrir a assinatura byte a byte. `timingSafeEqual` sempre percorre
 * tudo. O repositório já faz isso no webhook do WAHA e no de newsletter.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Prefixo que a Meta usa no cabeçalho. */
const PREFIX = "sha256=";

/**
 * O corpo confere com a assinatura?
 *
 * `false` para qualquer entrada malformada — cabeçalho ausente, sem prefixo, hex
 * inválido ou segredo vazio. Falhar fechado é o único comportamento aceitável:
 * na dúvida, o evento não é da Meta.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  if (!signatureHeader.startsWith(PREFIX)) return false;

  const received = signatureHeader.slice(PREFIX.length).trim();
  // Hex de SHA-256 tem exatamente 64 caracteres. Conferir antes evita que
  // `Buffer.from(..., "hex")` aceite lixo parcial em silêncio.
  if (!/^[0-9a-f]{64}$/i.test(received)) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const receivedBuf = Buffer.from(received, "hex");
  if (receivedBuf.length !== expected.length) return false;

  return timingSafeEqual(receivedBuf, expected);
}

/**
 * Resposta ao desafio de verificação da Meta (`GET` no webhook).
 *
 * A Meta chama uma vez, na configuração, com `hub.mode=subscribe` e um
 * `hub.verify_token` que VOCÊ cadastrou. Devolver o `hub.challenge` prova que a
 * URL é sua. Devolvê-lo sem conferir o token provaria apenas que a URL responde
 * — e qualquer um poderia registrar o seu endpoint no app dele.
 *
 * Devolve o desafio quando confere, ou `null` para o handler responder 403.
 */
export function answerVerificationChallenge(
  params: URLSearchParams,
  expectedVerifyToken: string,
): string | null {
  if (!expectedVerifyToken) return null;
  if (params.get("hub.mode") !== "subscribe") return null;

  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (!token || !challenge) return null;

  // Tempo constante também aqui: o token de verificação é um segredo, e o GET é
  // igualmente público.
  const a = Buffer.from(token);
  const b = Buffer.from(expectedVerifyToken);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return challenge;
}
