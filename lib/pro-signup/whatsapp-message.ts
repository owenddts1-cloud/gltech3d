/**
 * Mensagem pronta de WhatsApp para avisar o comprador.
 *
 * Função pura porque é onde dois erros silenciosos moram: a normalização do
 * telefone (o `wa.me` aceita só dígitos com DDI, e um número com máscara abre a
 * conversa errada ou nenhuma) e a codificação do texto — um link com `?` e `&`
 * não escapado trunca a mensagem exatamente onde importa.
 */

/**
 * Telefone no formato que o `wa.me` exige: só dígitos, com código do país.
 *
 * Assume Brasil quando o DDI está ausente — é a origem de 100% dos números
 * aqui, e o formulário público pede WhatsApp em formato nacional.
 * Devolve `null` quando não dá para montar algo plausível, em vez de gerar um
 * link que abre o WhatsApp num número inexistente.
 */
export function toWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;

  // Já tem DDI do Brasil.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  // Nacional com DDD: 10 (fixo) ou 11 (celular).
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  // Internacional plausível.
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/**
 * `"maria.souza@gmail.com"` → `"m***@gmail.com"`. Enough for the buyer to
 * recognize the address, without the WhatsApp text carrying it in full.
 */
export function maskEmail(email: string): string {
  const clean = email.trim();
  const at = clean.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${clean[0]}***${clean.slice(at)}`;
}

export interface ActivationMessageInput {
  buyerName: string;
  /** Already masked (`maskEmail`): where the activation link was sent. */
  maskedEmail: string;
  /** Quando houver, entra como "válido até". */
  expiresAt?: Date | null;
}

/**
 * O texto que o comprador recebe no caminho CRIAR.
 *
 * NÃO leva o link de ativação (pendência 19): o link cria a conta com o e-mail
 * do pedido já verificado, então ele só pode chegar por ESSE e-mail. Mandado
 * para o telefone do pedido, quem pagou usando o e-mail de outra pessoa
 * criaria a conta dela. A mensagem só avisa para onde o link foi.
 */
export function buildActivationMessage(input: ActivationMessageInput): string {
  const first = input.buyerName.trim().split(/\s+/)[0] || "";
  const saudacao = first ? `Oi, ${first}!` : "Oi!";
  const validade = input.expiresAt
    ? `\n\nO link vale até ${input.expiresAt.toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}.`
    : "";

  return (
    `${saudacao} Aqui é da GLTech3D.\n\n` +
    `Confirmei seu pagamento e seu Calc3D PRO já está liberado. ` +
    `Enviamos o link de ativação para o seu e-mail ${input.maskedEmail} — ` +
    `é por ele que você cria sua senha e entra (confira também a caixa de spam).${validade}`
  );
}

/** Mensagem para quem já tem conta (veio do trial ou renovou). */
export function buildUpgradeMessage(buyerName: string, appUrl: string): string {
  const first = buyerName.trim().split(/\s+/)[0] || "";
  const saudacao = first ? `Oi, ${first}!` : "Oi!";
  return (
    `${saudacao} Aqui é da GLTech3D.\n\n` +
    `Confirmei seu pagamento e o Calc3D PRO já está liberado na sua conta — ` +
    `é só entrar com a senha que você já usa:\n\n${appUrl}`
  );
}

/**
 * Link que abre a conversa com o texto pronto.
 *
 * `null` quando o telefone não serve — o chamador então esconde o botão, em vez
 * de oferecer uma ação que leva a lugar nenhum.
 */
export function buildWhatsappUrl(phone: string | null | undefined, message: string): string | null {
  const numero = toWhatsappNumber(phone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}
