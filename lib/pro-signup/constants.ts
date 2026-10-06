/** Bucket privado dos comprovantes de Pix, criado pela migration 0081. */
export const RECEIPT_BUCKET = "pro-receipts";

/**
 * Validade do link de ativação enviado ao comprador aprovado.
 *
 * Sete dias e não as 24h do convite de equipe: ali o convidado já estava
 * esperando o e-mail; aqui a aprovação pode sair num sábado e a pessoa só ver a
 * caixa de entrada na segunda. Link expirado vira pedido de suporte.
 */
export const ACTIVATION_TTL_SECONDS = 60 * 60 * 24 * 7;
