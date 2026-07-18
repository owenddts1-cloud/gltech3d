"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  SALES_PLATFORMS,
  SALES_STATUSES,
  SALES_FULFILLMENT,
  SALES_PAYMENT,
  type SaleFulfillment,
  type SalePayment,
  type SaleRow,
  type SalesKpis,
} from "@/lib/sales/config";

/**
 * Vendas de marketplace (migration 0048) — lançamento manual + agregação por
 * plataforma. Filtro/ordenação da tabela ficam no cliente (volume pequeno).
 */

const createSchema = z.object({
  platform: z.enum(SALES_PLATFORMS),
  customerName: z.string().trim().max(160).optional().default(""),
  status: z.enum(SALES_STATUSES).default("pago"),
  total: z.coerce.number().nonnegative().max(10_000_000),
  commission: z.coerce.number().nonnegative().max(10_000_000).optional().default(0),
  soldAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  notes: z.string().trim().max(2000).optional().default(""),
  /** FK → products.id (migration 0055). Enables sales bump trigger. */
  productId: z.string().uuid().nullable().optional(),
  qty: z.coerce.number().int().min(1).max(100_000).optional().default(1),
  /** Eixos de produção/pagamento do Kanban (migration 0058). */
  fulfillmentStatus: z.enum(SALES_FULFILLMENT).optional(),
  paymentStatus: z.enum(SALES_PAYMENT).optional(),
  boardPosition: z.coerce.number().nullable().optional(),
});

const patchSchema = createSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: "Nada para atualizar.",
});

interface Ctx {
  orgId: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

async function requireCtx(): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };
  return { ok: true, ctx: { orgId: activeOrg.orgId, userId: authUser.id, supabase: await createClient() } };
}

interface Row {
  id: string;
  platform: string;
  customer_name: string | null;
  status: string;
  fulfillment_status: string | null;
  payment_status: string | null;
  board_position: number | string | null;
  total_cents: number | string;
  commission_cents: number | string;
  sold_at: string;
  notes: string | null;
}

/** Colunas lidas de marketplace_orders — reusado em fetch/create/update. */
const SALE_SELECT =
  "id, platform, customer_name, status, fulfillment_status, payment_status, board_position, total_cents, commission_cents, sold_at, notes";

function toView(r: Row): SaleRow {
  // Fallbacks defensivos: linhas anteriores à 0058 podem não ter os eixos novos.
  const fulfillment = (SALES_FULFILLMENT as readonly string[]).includes(r.fulfillment_status ?? "")
    ? (r.fulfillment_status as SaleFulfillment)
    : "confirmada";
  const payment = (SALES_PAYMENT as readonly string[]).includes(r.payment_status ?? "")
    ? (r.payment_status as SalePayment)
    : "pendente";
  return {
    id: r.id,
    platform: r.platform,
    customerName: r.customer_name,
    status: r.status,
    fulfillmentStatus: fulfillment,
    paymentStatus: payment,
    boardPosition: r.board_position == null ? null : Number(r.board_position),
    totalCents: Number(r.total_cents),
    commissionCents: Number(r.commission_cents),
    soldAt: r.sold_at,
    notes: r.notes,
  };
}

/** `platform` filtra por canal; ausente = todos. */
export async function fetchSales(platform?: string) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  let query = c.ctx.supabase
    .from("marketplace_orders")
    .select(SALE_SELECT)
    .order("sold_at", { ascending: false });
  if (platform && (SALES_PLATFORMS as readonly string[]).includes(platform)) {
    query = query.eq("platform", platform);
  }

  const { data, error } = await query;
  if (error) return { ok: false as const, error: error.message };

  const sales = ((data as Row[] | null) ?? []).map(toView);
  // KPIs consideram só o que não foi cancelado.
  const active = sales.filter((s) => s.status !== "cancelado");
  const totalCents = active.reduce((s, r) => s + r.totalCents, 0);
  const commissionCents = active.reduce((s, r) => s + r.commissionCents, 0);
  const kpis: SalesKpis = {
    totalCents,
    netCents: totalCents - commissionCents,
    count: active.length,
    avgTicketCents: active.length ? Math.round(totalCents / active.length) : 0,
  };

  // Total por plataforma (para a visão geral).
  const byPlatform = SALES_PLATFORMS.map((p) => ({
    platform: p,
    totalCents: active.filter((s) => s.platform === p).reduce((s, r) => s + r.totalCents, 0),
    count: active.filter((s) => s.platform === p).length,
  })).filter((x) => x.count > 0);

  return { ok: true as const, sales, kpis, byPlatform };
}

export async function createSale(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = parsed.data;

  const { data, error } = await c.ctx.supabase
    .from("marketplace_orders")
    .insert({
      organization_id: c.ctx.orgId,
      platform: d.platform,
      customer_name: d.customerName || null,
      status: d.status,
      total_cents: Math.round(d.total * 100),
      commission_cents: Math.round((d.commission ?? 0) * 100),
      sold_at: d.soldAt,
      notes: d.notes || null,
      product_id: d.productId ?? null,
      qty: d.qty ?? 1,
      fulfillment_status: d.fulfillmentStatus ?? "confirmada",
      payment_status: d.paymentStatus ?? (d.status === "cancelado" ? "estornado" : "pendente"),
      created_by: c.ctx.userId,
    })
    .select(SALE_SELECT)
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/sales");
  return { ok: true as const, sale: toView(data as Row) };
}

export async function updateSale(id: string, raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (d.platform !== undefined) patch.platform = d.platform;
  if (d.customerName !== undefined) patch.customer_name = d.customerName || null;
  if (d.status !== undefined) patch.status = d.status;
  if (d.total !== undefined) patch.total_cents = Math.round(d.total * 100);
  if (d.commission !== undefined) patch.commission_cents = Math.round(d.commission * 100);
  if (d.soldAt !== undefined) patch.sold_at = d.soldAt;
  if (d.notes !== undefined) patch.notes = d.notes || null;
  if (d.productId !== undefined) patch.product_id = d.productId;
  if (d.qty !== undefined) patch.qty = d.qty;
  if (d.fulfillmentStatus !== undefined) patch.fulfillment_status = d.fulfillmentStatus;
  if (d.paymentStatus !== undefined) patch.payment_status = d.paymentStatus;
  if (d.boardPosition !== undefined) patch.board_position = d.boardPosition;

  const { error } = await c.ctx.supabase
    .from("marketplace_orders")
    .update(patch)
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/sales");
  return { ok: true as const };
}

export async function deleteSale(id: string) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { error } = await c.ctx.supabase
    .from("marketplace_orders")
    .delete()
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/sales");
  return { ok: true as const };
}
