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

export interface SaleRow {
  id: string;
  platform: string;
  customerName: string | null;
  status: string;
  totalCents: number;
  commissionCents: number;
  soldAt: string;
  notes: string | null;
}

export interface SalesKpis {
  totalCents: number;
  netCents: number;
  count: number;
  avgTicketCents: number;
}
