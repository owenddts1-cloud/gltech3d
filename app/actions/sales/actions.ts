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
  type SaleProductOption,
  type SaleRow,
  type SalesKpis,
} from "@/lib/sales/config";
import { computeProductPricing } from "@/lib/pricing/engine";
import { fetchContactOptions } from "@/app/actions/contacts/actions";

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
  /** FK → contacts.id (migration 0060). Vínculo real, não mais por nome. */
  contactId: z.string().uuid().nullable().optional(),
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
  contact_id: string | null;
  product_id: string | null;
  qty: number | string | null;
  sold_at: string;
  notes: string | null;
}

/** Colunas lidas de marketplace_orders — reusado em fetch/create/update. */
const SALE_SELECT =
  "id, platform, customer_name, status, fulfillment_status, payment_status, board_position, total_cents, commission_cents, contact_id, product_id, qty, sold_at, notes";

/** Custo unitário (engine de precificação) por produto do catálogo. */
interface ProductCostInfo {
  name: string;
  unitCostCents: number;
  suggestedPriceCents: number;
}

interface CostProdRow {
  id: string; name: string; filament_client_id: string | null; filament_grams: number | string;
  print_time_seconds: number | string; printer_client_id: string | null; extra_costs: unknown;
  margin_pct: number | string;
}

const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));

/**
 * Mapa produto → custo unitário real (material + energia + depreciação + insumos),
 * calculado com a MESMA engine da tela de Produtos. Fonte do custo/margem por venda.
 */
async function buildProductCostMap(
  supabase: Ctx["supabase"],
  orgId: string,
): Promise<Map<string, ProductCostInfo>> {
  const [prodRes, filRes, prnRes, orgRes] = await Promise.all([
    supabase.from("products").select("id, name, filament_client_id, filament_grams, print_time_seconds, printer_client_id, extra_costs, margin_pct"),
    supabase.from("filaments").select("client_id, cost_per_gram"),
    supabase.from("printers").select("client_id, power_draw, depreciation_per_hour"),
    supabase.from("organizations").select("settings").eq("id", orgId).single(),
  ]);

  const filMap = new Map(
    (((filRes.data as Array<{ client_id: string; cost_per_gram: number | string }> | null) ?? []))
      .map((f) => [f.client_id, num(f.cost_per_gram)]),
  );
  const prnMap = new Map(
    (((prnRes.data as Array<{ client_id: string; power_draw: number | string; depreciation_per_hour: number | string }> | null) ?? []))
      .map((p) => [p.client_id, { powerDraw: num(p.power_draw), depreciation: num(p.depreciation_per_hour) }]),
  );
  const kEnergy = ((orgRes.data?.settings as Record<string, unknown> | null)?.k_energy as number) || 0.85;

  const map = new Map<string, ProductCostInfo>();
  for (const r of ((prodRes.data as CostProdRow[] | null) ?? [])) {
    const prn = r.printer_client_id ? prnMap.get(r.printer_client_id) : undefined;
    const extras = Array.isArray(r.extra_costs)
      ? (r.extra_costs as Array<{ cost_cents: number | string }>).reduce((s, e) => s + num(e.cost_cents), 0)
      : 0;
    const pricing = computeProductPricing({
      filamentGrams: num(r.filament_grams),
      costPerGram: r.filament_client_id ? (filMap.get(r.filament_client_id) ?? 0) : 0,
      printTimeSeconds: num(r.print_time_seconds),
      kEnergy,
      powerDraw: prn?.powerDraw ?? 200,
      depreciationPerHour: prn?.depreciation ?? 0.4,
      extraCostCents: extras,
      marginPct: num(r.margin_pct),
    });
    map.set(r.id, {
      name: r.name,
      unitCostCents: Math.round(pricing.totalCost * 100),
      suggestedPriceCents: Math.round(pricing.suggestedPrice * 100),
    });
  }
  return map;
}

/** Anexa produto/custo à venda a partir do mapa (qty × custo unitário). */
function withCost(sale: SaleRow, costMap: Map<string, ProductCostInfo>): SaleRow {
  if (!sale.productId) return sale;
  const info = costMap.get(sale.productId);
  if (!info) return sale;
  return { ...sale, productName: info.name, costCents: info.unitCostCents * sale.qty };
}

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
    contactId: r.contact_id ?? null,
    productId: r.product_id ?? null,
    productName: null,
    qty: Math.max(1, Math.round(num(r.qty)) || 1),
    costCents: null,
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

  const [{ data, error }, costMap, contactsRes] = await Promise.all([
    query,
    buildProductCostMap(c.ctx.supabase, c.ctx.orgId),
    fetchContactOptions(),
  ]);
  if (error) return { ok: false as const, error: error.message };

  const sales = ((data as Row[] | null) ?? []).map((r) => withCost(toView(r), costMap));
  // KPIs consideram só o que não foi cancelado. Líquido = total − comissão − custo.
  const active = sales.filter((s) => s.status !== "cancelado");
  const totalCents = active.reduce((s, r) => s + r.totalCents, 0);
  const commissionCents = active.reduce((s, r) => s + r.commissionCents, 0);
  const costCents = active.reduce((s, r) => s + (r.costCents ?? 0), 0);
  const kpis: SalesKpis = {
    totalCents,
    netCents: totalCents - commissionCents - costCents,
    costCents,
    count: active.length,
    avgTicketCents: active.length ? Math.round(totalCents / active.length) : 0,
  };

  // Total por plataforma (para a visão geral).
  const byPlatform = SALES_PLATFORMS.map((p) => ({
    platform: p,
    totalCents: active.filter((s) => s.platform === p).reduce((s, r) => s + r.totalCents, 0),
    count: active.filter((s) => s.platform === p).length,
  })).filter((x) => x.count > 0);

  // Opções p/ vincular produto (combobox de Vendas): custo/preço da engine.
  const productOptions: SaleProductOption[] = Array.from(costMap.entries())
    .map(([id, p]) => ({ id, name: p.name, unitCostCents: p.unitCostCents, suggestedPriceCents: p.suggestedPriceCents }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  // Opções p/ vincular cliente (combobox de Vendas): contatos reais da org.
  const contactOptions = contactsRes.ok ? contactsRes.contacts : [];

  return { ok: true as const, sales, kpis, byPlatform, productOptions, contactOptions };
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
      contact_id: d.contactId ?? null,
      product_id: d.productId ?? null,
      qty: d.qty ?? 1,
      fulfillment_status: d.fulfillmentStatus ?? "confirmada",
      payment_status: d.paymentStatus ?? (d.status === "cancelado" ? "estornado" : "pendente"),
      created_by: c.ctx.userId,
    })
    .select(SALE_SELECT)
    .single();
  if (error) return { ok: false as const, error: error.message };

  let sale = toView(data as Row);
  if (sale.productId) {
    sale = withCost(sale, await buildProductCostMap(c.ctx.supabase, c.ctx.orgId));
  }

  revalidatePath("/app/sales");
  return { ok: true as const, sale };
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
  if (d.contactId !== undefined) patch.contact_id = d.contactId;
  if (d.productId !== undefined) patch.product_id = d.productId;
  if (d.qty !== undefined) patch.qty = d.qty;
  if (d.fulfillmentStatus !== undefined) patch.fulfillment_status = d.fulfillmentStatus;
  if (d.paymentStatus !== undefined) patch.payment_status = d.paymentStatus;
  if (d.boardPosition !== undefined) patch.board_position = d.boardPosition;

  const { data, error } = await c.ctx.supabase
    .from("marketplace_orders")
    .update(patch)
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id)
    .select(SALE_SELECT)
    .single();
  if (error) return { ok: false as const, error: error.message };

  // Devolve a venda atualizada COM custo — o drawer usa p/ reconciliar o estado
  // após vincular produto/qty (custo muda junto).
  let sale = toView(data as Row);
  if (sale.productId) {
    sale = withCost(sale, await buildProductCostMap(c.ctx.supabase, c.ctx.orgId));
  }

  revalidatePath("/app/sales");
  return { ok: true as const, sale };
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
