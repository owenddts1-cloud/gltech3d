/**
 * Pedido de liberação do Calc3D PRO, enviado pelo formulário público depois que
 * o comprador declara ter feito o Pix.
 *
 * Duas decisões de segurança moram aqui:
 *
 * 1. `amount_cents` NÃO existe neste schema. O valor é derivado de `plan` em
 *    `lib/pricing/pro-plans.ts`, no servidor. Aceitar preço pelo corpo exigiria
 *    validá-lo contra a tabela de qualquer forma — derivar elimina a classe de
 *    tampering em vez de tentar detectá-la.
 * 2. `.strict()` rejeita chave desconhecida. O corpo vem de um formulário
 *    público e vai direto para um INSERT com service role, que bypassa RLS;
 *    aceitar extras silenciosamente é como `organization_id` entraria pelo body.
 */
import { z } from "zod";

/** `<uuid>/<arquivo>`: o prefixo é gerado no servidor, nunca pelo cliente. */
export const RECEIPT_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[\w.\- ]{1,200}$/;

export const proSignupRequestSchema = z
  .object({
    buyer_name: z.string().trim().min(2).max(120),
    buyer_email: z.string().trim().toLowerCase().email().max(200),
    /** Cru como digitado (com máscara). Normalizado para E.164 no servidor. */
    buyer_phone: z.string().trim().min(8).max(40),
    company_name: z.string().trim().min(2).max(120).optional(),
    plan: z.literal("pro").default("pro"),
    /** Identificador da transação Pix, se o comprador quiser informar. */
    pix_txid: z.string().trim().max(64).optional(),
    /** Checkbox "declaro que já fiz o Pix" — sem ela não há pedido. */
    declared_paid: z.literal(true),
    /** Consentimento LGPD. */
    consent: z.literal(true),
    receipt_path: z.string().trim().max(300).regex(RECEIPT_PATH_RE).optional(),
    /** Honeypot: campo escondido no formulário. Bot preenche, humano não. */
    website: z.string().max(0).optional(),
    /** Tempo de preenchimento. Menos de 2s é robô. */
    elapsed_ms: z.coerce.number().int().min(2000).optional(),
  })
  .strict();

export type ProSignupRequestInput = z.infer<typeof proSignupRequestSchema>;

/** Tipos e tamanho precisam bater com o que a migration 0081 impõe no bucket. */
export const RECEIPT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export const receiptSlotSchema = z
  .object({
    filename: z.string().trim().min(1).max(200),
    content_type: z.enum(RECEIPT_MIME_TYPES),
    size: z.coerce.number().int().positive().max(RECEIPT_MAX_BYTES),
  })
  .strict();

export type ReceiptSlotInput = z.infer<typeof receiptSlotSchema>;

/**
 * Nome de arquivo seguro para compor o caminho no Storage. O prefixo UUID já
 * garante unicidade; aqui só removemos o que poderia escapar do diretório ou
 * confundir o Storage.
 */
// Marcas diacríticas combinantes (acentos soltos depois do NFD). Escrito como
// string escapada para o arquivo-fonte permanecer ASCII puro.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function safeReceiptFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "comprovante";
  const cleaned = base
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^\w.\- ]+/g, "-")
    .replace(/^[.\-]+/, "")
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : "comprovante";
}
