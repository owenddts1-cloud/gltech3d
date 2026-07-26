/**
 * Contrato do `service_order_documents.snapshot` (migration 0068).
 *
 * Este arquivo é a ÚNICA porta de entrada e saída do jsonb: validado ao gravar e
 * validado ao ler. Nenhum componente lê path cru do snapshot — é isso que impede
 * o lock-in de jsonb virar dívida (anti-pattern #6 do CLAUDE.md).
 *
 * O snapshot é AUTO-SUFICIENTE de propósito: a impressão não faz join nenhum, então
 * renomear a empresa, mudar o endereço do cliente ou apagar um produto não altera
 * um documento já entregue.
 *
 * Contratos:
 *  - documentSnapshotSchema → leitura e escrita do jsonb
 *  - emitDocumentSchema     → emitServiceOrderDocument()
 *  - saveItemsSchema        → saveServiceOrderItems()
 */
import { z } from "zod";

export const DOC_TYPES = ["orcamento", "ordem_servico", "recibo"] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const docTypeSchema = z.enum(DOC_TYPES);

/** Rótulos do seletor e do cabeçalho impresso. */
export const DOC_TYPE_LABEL: Record<DocType, string> = {
  orcamento: "Proposta Comercial / Orçamento",
  ordem_servico: "Ordem de Serviço",
  recibo: "Recibo de Pagamento",
};

/** Rótulo curto, para abas e botões. */
export const DOC_TYPE_SHORT: Record<DocType, string> = {
  orcamento: "Orçamento",
  ordem_servico: "Ordem de Serviço",
  recibo: "Recibo",
};

/** Aceita o valor vindo da querystring `?tipo=`, com fallback para orçamento. */
export function parseDocType(raw: string | string[] | undefined): DocType {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "os") return "ordem_servico";
  const parsed = docTypeSchema.safeParse(v);
  return parsed.success ? parsed.data : "orcamento";
}

/** Texto livre opcional que vira string vazia em vez de `undefined` no snapshot. */
const text = (max: number) => z.string().trim().max(max).default("");

export const docAddressSchema = z.object({
  street: text(200),
  number: text(20),
  complement: text(100),
  district: text(120),
  city: text(120),
  state: text(2),
  cep: text(12),
});
export type DocAddressInput = z.infer<typeof docAddressSchema>;

export const docOrgSchema = z.object({
  displayName: text(200),
  legalName: text(200),
  cnpj: text(32),
  logoUrl: z.string().trim().max(2048).default(""),
  phone: text(40),
  email: text(200),
  site: text(200),
  instagram: text(120),
  address: docAddressSchema.default({}),
  footerNote: text(300),
});

export const docCustomerSchema = z.object({
  contactId: z.string().uuid().nullable().default(null),
  name: text(200),
  contactPerson: text(200),
  documentNumber: text(32),
  email: text(200),
  phone: text(40),
  address: docAddressSchema.default({}),
});

export const docServiceOrderSchema = z.object({
  id: z.string().uuid(),
  code: z.string().trim().max(40).nullable().default(null),
  title: text(300),
  status: text(40),
  material: text(120),
  slaDueAt: z.string().nullable().default(null),
  createdAt: z.string().nullable().default(null),
  layerHeight: text(40).default(""),
  infill: text(40).default(""),
  supports: text(60).default(""),
});

export const docItemSchema = z.object({
  productId: z.string().uuid().nullable().default(null),
  name: z.string().trim().min(1).max(300),
  description: text(600),
  qty: z.number().positive().max(1_000_000),
  unitPriceCents: z.number().int().min(0).max(1_000_000_000_00),
  imageUrl: z.string().trim().max(2048).nullable().default(null),
});
export type DocItemInput = z.infer<typeof docItemSchema>;

export const docTotalsSchema = z.object({
  subtotalCents: z.number().int().min(0),
  discountCents: z.number().int().min(0).default(0),
  shippingCents: z.number().int().min(0).default(0),
  totalCents: z.number().int().min(0),
});
export type DocTotals = z.infer<typeof docTotalsSchema>;

export const PAYMENT_METHODS = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "boleto",
  "outro",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência bancária",
  boleto: "Boleto",
  outro: "Outro",
};

export const docPaymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS).default("pix"),
  methodNote: text(120),
  installments: z.number().int().min(1).max(60).default(1),
  paidAt: z.string().nullable().default(null),
  /** Recalculado no servidor a partir de `totals.totalCents` — nunca confiar no cliente. */
  amountInWords: text(400),
});

export const docTermsSchema = z.object({
  validityDays: z.number().int().min(0).max(365).default(15),
  deliveryEstimate: text(200),
  warranty: text(600),
  paymentConditions: text(600),
  productionNotes: text(1000),
  notes: text(1000),
});

export const docSignatureSchema = z.object({
  showLines: z.boolean().default(true),
  signerName: text(200),
  signerRole: text(120),
  city: text(120),
});

export const PHOTO_DISPLAY_MODES = ["table", "gallery", "both", "none"] as const;
export type PhotoDisplayMode = (typeof PHOTO_DISPLAY_MODES)[number];

export const docOptionsSchema = z.object({
  /** Exibição das fotos: tabela, galeria numerada no rodapé (❶ ❷ ❸), ambas ou nenhuma. */
  showItemPhotos: z.boolean().default(true),
  photoDisplayMode: z.enum(PHOTO_DISPLAY_MODES).default("table"),
  showUnitPrices: z.boolean().default(true),
  showFooterNote: z.boolean().default(true),
});

export const documentSnapshotSchema = z.object({
  version: z.literal(1),
  docType: docTypeSchema,
  issuedAt: z.string(),
  org: docOrgSchema,
  customer: docCustomerSchema,
  serviceOrder: docServiceOrderSchema,
  items: z.array(docItemSchema).min(1).max(200),
  totals: docTotalsSchema,
  payment: docPaymentSchema,
  terms: docTermsSchema,
  signature: docSignatureSchema,
  options: docOptionsSchema,
  description: text(2000),
  heroImageUrl: z.string().trim().max(2048).nullable().default(null),
  meta: z.object({
    emittedByUserId: z.string().uuid().nullable().default(null),
    emittedByName: text(200),
  }),
});
export type DocumentSnapshot = z.infer<typeof documentSnapshotSchema>;

/** O que o renderizador recebe: o snapshot + o que é coluna, não jsonb. */
export interface RenderableDocument {
  snapshot: DocumentSnapshot;
  number: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export const emitDocumentSchema = z.object({
  serviceOrderId: z.string().uuid(),
  docType: docTypeSchema,
  snapshot: documentSnapshotSchema,
});
export type EmitDocumentInput = z.infer<typeof emitDocumentSchema>;

export const voidDocumentSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

/** Itens persistidos na O.S. (tabela real), não os itens do snapshot. */
export const saveItemsSchema = z.object({
  serviceOrderId: z.string().uuid(),
  items: z
    .array(
      docItemSchema.extend({
        /** `null` = item novo; uuid = item existente que deve ser preservado. */
        id: z.string().uuid().nullable().default(null),
      }),
    )
    .max(200),
});
export type SaveItemsInput = z.infer<typeof saveItemsSchema>;

/** Endereço/documento fiscal gravados de volta no cadastro do cliente. */
export const contactAddressSchema = z.object({
  document_number: z.string().trim().max(32).nullable().default(null),
  address: z.string().trim().max(200).nullable().default(null),
  address_number: z.string().trim().max(20).nullable().default(null),
  address_complement: z.string().trim().max(100).nullable().default(null),
  district: z.string().trim().max(120).nullable().default(null),
  city: z.string().trim().max(120).nullable().default(null),
  state: z
    .string()
    .trim()
    .max(2)
    .nullable()
    .default(null)
    .refine((v) => v === null || v.length === 0 || v.length === 2, "UF deve ter 2 letras"),
  cep: z.string().trim().max(12).nullable().default(null),
});
export type ContactAddressInput = z.infer<typeof contactAddressSchema>;
