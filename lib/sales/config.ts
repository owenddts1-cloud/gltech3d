/**
 * Constantes e tipos de Vendas. Fora do módulo `"use server"` (lá só funções
 * async podem ser exportadas — const/tipo derruba o build da página).
 */

export const SALES_PLATFORMS = [
  "Shopee",
  "Mercado Livre",
  "Facebook",
  "TikTok Shop",
  "Olx",
  "B2B",
  "Outro",
] as const;
export type SalesPlatform = (typeof SALES_PLATFORMS)[number];

export const SALES_STATUSES = ["pendente", "pago", "enviado", "concluido", "cancelado"] as const;

/**
 * Esteira de PRODUÇÃO (migration 0058) — eixo separado do pagamento. Ordem = ordem
 * das colunas do Kanban. `cancelada` é terminal e fica fora do fluxo linear.
 */
export const SALES_FULFILLMENT = [
  "confirmada",
  "produzindo",
  "pronta",
  "enviada",
  "entregue",
  "cancelada",
] as const;
export type SaleFulfillment = (typeof SALES_FULFILLMENT)[number];

export const FULFILLMENT_LABEL: Record<SaleFulfillment, string> = {
  confirmada: "Confirmada",
  produzindo: "Produzindo",
  pronta: "Pronta",
  enviada: "Enviada",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

/** Colunas do Kanban, na ordem do board (sem a terminal `cancelada`). */
export const KANBAN_STAGES: SaleFulfillment[] = [
  "confirmada",
  "produzindo",
  "pronta",
  "enviada",
  "entregue",
];

/** Eixo de PAGAMENTO (migration 0058), independente da produção. */
export const SALES_PAYMENT = ["pendente", "pago", "estornado"] as const;
export type SalePayment = (typeof SALES_PAYMENT)[number];

export const PAYMENT_LABEL: Record<SalePayment, string> = {
  pendente: "Pendente",
  pago: "Pago",
  estornado: "Estornado",
};

export interface SaleRow {
  id: string;
  platform: string;
  customerName: string | null;
  /** Status legado (0048) — mantido para compat; não é o eixo do Kanban. */
  status: string;
  /** Esteira de produção (0058) — eixo do Kanban. */
  fulfillmentStatus: SaleFulfillment;
  /** Pagamento (0058) — eixo independente. */
  paymentStatus: SalePayment;
  /** Ordenação fracionária dentro da coluna do Kanban (0058). */
  boardPosition: number | null;
  totalCents: number;
  commissionCents: number;
  /** Contato ligado à venda (0060) — FK real, não mais inferência por nome. */
  contactId: string | null;
  /** Produto do catálogo ligado à venda (0055) — habilita custo/margem reais. */
  productId: string | null;
  productName: string | null;
  qty: number;
  /** Custo de produção TOTAL da venda (unitário × qty), em cents. Null sem produto. */
  costCents: number | null;
  soldAt: string;
  notes: string | null;
}

/** Opção de produto p/ vincular a vendas (combobox) — custo unitário da engine. */
export interface SaleProductOption {
  id: string;
  name: string;
  unitCostCents: number;
  suggestedPriceCents: number;
}

export interface SalesKpis {
  totalCents: number;
  /** Líquido REAL: total − comissões − custos de produção conhecidos (E5). */
  netCents: number;
  /** Soma dos custos de produção das vendas com produto vinculado. */
  costCents: number;
  count: number;
  avgTicketCents: number;
}
