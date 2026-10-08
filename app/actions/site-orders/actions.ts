"use server";

/**
 * CRM side of the public cart orders (`site_orders` + `site_order_items`,
 * migration 0087). Rows are created only by POST /api/v1/public/filament-orders
 * (service role); here the shop lists them, changes their status and converts
 * a confirmed cart into sales (`marketplace_orders`, one row per item — which
 * is what feeds the stock trigger of 0072 and every sales report).
 *
 * Org from the session, explicit `organization_id` filters, user client (RLS:
 * member reads, agent+ updates). Writes are PRO-gated via `requireCtx()`.
 * Status changes are audited by the row trigger on site_orders; the conversion
 * also writes `site_order.converted` because it spans two tables.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { assertProAccess } from "@/lib/plan/server";
import { ROLE_RANK, type Role } from "@/lib/auth/types";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { orderShortId, SITE_ORDER_STATUSES, type SiteOrderStatus } from "@/lib/site-orders/core";

export interface SiteOrderItemView {
  id: string;
  productId: string | null;
  productName: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface SiteOrderView {
  id: string;
  shortId: string;
  customerName: string;
  /** Digits with country code (e.g. 5531988887777). */
  customerWhatsapp: string;
  status: SiteOrderStatus;
  totalCents: number;
  source: "site_filamentos" | "site_produtos";
  notes: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  items: SiteOrderItemView[];
}

export type SiteOrderActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;
interface Ctx {
  orgId: string;
  userId: string;
  role: Role;
  supabase: Supabase;
}
type CtxResult = { ok: true; ctx: Ctx } | { ok: false; error: string };

async function readCtx(): Promise<CtxResult> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };
  return {
    ok: true,
    ctx: { orgId: activeOrg.orgId, userId: authUser.id, role: activeOrg.role, supabase: await createClient() },
  };
}

/** Write context: PRO gate + agent or above (mirrors the UPDATE policy of 0087). */
async function requireCtx(): Promise<CtxResult> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false, error: denied };
  if (ROLE_RANK[activeOrg.role] < ROLE_RANK.agent && !authUser.is_platform_admin) {
    return { ok: false, error: "Alterar pedidos do site exige perfil de atendente ou acima." };
  }
  return {
    ok: true,
    ctx: { orgId: activeOrg.orgId, userId: authUser.id, role: activeOrg.role, supabase: await createClient() },
  };
}

const ORDER_SELECT =
  "id, customer_name, customer_whatsapp, status, total_cents, source, notes, converted_at, created_at, updated_at, site_order_items(id, product_id, product_name, qty, unit_price_cents)";

interface OrderRow {
  id: string;
  customer_name: string;
  customer_whatsapp: string;
  status: string;
  total_cents: number | string;
  source: string;
  notes: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string | null;
  site_order_items: Array<{
    id: string;
    product_id: string | null;
    product_name: string;
    qty: number | string;
    unit_price_cents: number | string;
  }> | null;
}

function toView(r: OrderRow): SiteOrderView {
  const status = (SITE_ORDER_STATUSES as readonly string[]).includes(r.status)
    ? (r.status as SiteOrderStatus)
    : "novo";
  return {
    id: r.id,
    shortId: orderShortId(r.id),
    customerName: r.customer_name,
    customerWhatsapp: r.customer_whatsapp,
    status,
    totalCents: Number(r.total_cents),
    source: r.source === "site_produtos" ? "site_produtos" : "site_filamentos",
    notes: r.notes,
    convertedAt: r.converted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: (r.site_order_items ?? []).map((i) => {
      const qty = Number(i.qty);
      const unit = Number(i.unit_price_cents);
      return {
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        qty,
        unitPriceCents: unit,
        lineTotalCents: qty * unit,
      };
    }),
  };
}

function migrationHint(error: { code?: string; message: string }): string {
  if (error.code === "42P01" || error.code === "42703") {
    return `Falta aplicar a migration 0087 do banco (${error.message}).`;
  }
  return error.message;
}

function refresh(): void {
  revalidatePath("/app/pedidos-site");
  revalidatePath("/app/sales");
}

const statusFilterSchema = z.enum(SITE_ORDER_STATUSES).optional();

/** Orders of the active org, newest first. `status` filters; absent = all. Max 500. */
export async function listSiteOrders(
  status?: SiteOrderStatus,
): Promise<SiteOrderActionResult<{ orders: SiteOrderView[] }>> {
  const c = await readCtx();
  if (!c.ok) return c;
  const parsed = statusFilterSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: "Status inválido." };

  let query = c.ctx.supabase
    .from("site_orders")
    .select(ORDER_SELECT)
    .eq("organization_id", c.ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (parsed.data) query = query.eq("status", parsed.data);

  const { data, error } = await query;
  if (error) return { ok: false, error: migrationHint(error) };
  return { ok: true, orders: ((data ?? []) as unknown as OrderRow[]).map(toView) };
}

const statusPatchSchema = z
  .object({ id: z.string().uuid(), status: z.enum(SITE_ORDER_STATUSES) })
  .strict();

/**
 * Changes the status. A converted order cannot go back to `novo` nor be
 * cancelled here — its sales already exist; cancel them in Vendas.
 */
export async function updateSiteOrderStatus(
  raw: unknown,
): Promise<SiteOrderActionResult<{ order: SiteOrderView }>> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const { ctx } = c;

  const parsed = statusPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const { id, status } = parsed.data;

  const { data: current, error: readErr } = await ctx.supabase
    .from("site_orders")
    .select("id, converted_at")
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, error: migrationHint(readErr) };
  if (!current) return { ok: false, error: "Pedido não encontrado." };
  if ((current as { converted_at: string | null }).converted_at && status !== "confirmado") {
    return {
      ok: false,
      error: "Este pedido já virou venda. Para desfazer, cancele as vendas na tela de Vendas.",
    };
  }

  let update = ctx.supabase
    .from("site_orders")
    .update({ status })
    .eq("organization_id", ctx.orgId)
    .eq("id", id);
  // Race guard: a conversion may land between the read above and this write.
  // Anything but 'confirmado' only applies while the order is NOT converted.
  if (status !== "confirmado") update = update.is("converted_at", null);
  const { data, error } = await update.select(ORDER_SELECT);
  if (error) return { ok: false, error: migrationHint(error) };
  if (status !== "confirmado" && (!data || (data as unknown[]).length === 0)) {
    return {
      ok: false,
      error: "Este pedido já virou venda. Para desfazer, cancele as vendas na tela de Vendas.",
    };
  }
  // RLS (0087): UPDATE requires agent+; a denied update matches 0 rows silently.
  const row = (data as unknown as OrderRow[] | null)?.[0];
  if (!row) return { ok: false, error: "Nada foi alterado: o pedido não existe mais ou seu perfil não permite." };

  refresh();
  return { ok: true, order: toView(row) };
}

/** Today's date in São Paulo (YYYY-MM-DD) — `sold_at` is a date, not an instant. */
function todaySaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const orderIdSchema = z.string().uuid();

/**
 * Turns a cart into sales: one `marketplace_orders` row per item (platform
 * 'Outro', status 'pago', product + qty, total = qty × snapshot unit price,
 * notes "Pedido do site #XXXX", sold today), then marks the cart `confirmado`
 * with `converted_at`.
 *
 * Idempotent: the cart is CLAIMED first with a conditional update on
 * `converted_at is null`, so a double click or two tabs convert it once. If the
 * sales insert fails, the claim is reverted and nothing was sold.
 *
 * `converted_at` is written (claim and revert) with the SERVICE ROLE: the
 * authenticated role may only update status/notes of site_orders, and a
 * trigger refuses resetting `converted_at` outside service_role — otherwise a
 * member could "un-convert" an order and convert it again (duplicate sales).
 * Used only after the session/role/PRO checks of `requireCtx()`, filtered by
 * the SESSION org and the order id. The sales themselves are inserted with
 * the user client (RLS applies).
 */
export async function convertSiteOrderToSales(
  orderId: string,
): Promise<SiteOrderActionResult<{ order: SiteOrderView; salesCreated: number }>> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const { ctx } = c;

  const parsedId = orderIdSchema.safeParse(orderId);
  if (!parsedId.success) return { ok: false, error: "Pedido inválido." };
  const id = parsedId.data;

  const { data: found, error: readErr } = await ctx.supabase
    .from("site_orders")
    .select(ORDER_SELECT)
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, error: migrationHint(readErr) };
  if (!found) return { ok: false, error: "Pedido não encontrado." };
  const order = toView(found as unknown as OrderRow);
  if (order.convertedAt) return { ok: false, error: "Este pedido já foi convertido em vendas." };
  if (order.status === "cancelado") return { ok: false, error: "Pedido cancelado não vira venda." };
  if (order.items.length === 0) return { ok: false, error: "Pedido sem itens." };

  const convertedAt = new Date().toISOString();
  const admin = createAdminClient();
  const { data: claimed, error: claimErr } = await admin
    .from("site_orders")
    .update({ converted_at: convertedAt, status: "confirmado" })
    .eq("organization_id", ctx.orgId)
    .eq("id", id)
    .is("converted_at", null)
    .select("id");
  if (claimErr) return { ok: false, error: migrationHint(claimErr) };
  if (!claimed || claimed.length === 0) {
    return { ok: false, error: "Este pedido já foi convertido." };
  }

  const soldAt = todaySaoPaulo();
  const notes = `Pedido do site #${order.shortId}`;
  const sales = order.items.map((item) => ({
    organization_id: ctx.orgId,
    platform: "Outro",
    customer_name: order.customerName,
    status: "pago",
    payment_status: "pago",
    fulfillment_status: "confirmada",
    total_cents: item.lineTotalCents,
    commission_cents: 0,
    sold_at: soldAt,
    notes,
    product_id: item.productId,
    // Product deleted since the order: the sale is an off-catalog item (0078).
    is_custom_item: item.productId === null,
    qty: item.qty,
    created_by: ctx.userId,
  }));

  const { data: inserted, error: salesErr } = await ctx.supabase
    .from("marketplace_orders")
    .insert(sales)
    .select("id");
  if (salesErr || !inserted) {
    // Reverts only OUR claim (same converted_at), never someone else's.
    const { error: revertErr } = await admin
      .from("site_orders")
      .update({ converted_at: null, status: order.status })
      .eq("organization_id", ctx.orgId)
      .eq("id", id)
      .eq("converted_at", convertedAt);
    if (revertErr) {
      // The cart says "converted" with no sales. Needs a human: logged with ids.
      logger.error("site_order_convert_revert_failed", {
        orgId: ctx.orgId,
        orderId: id,
        details: revertErr.message,
      });
    }
    return { ok: false, error: salesErr ? migrationHint(salesErr) : "Falha ao criar as vendas." };
  }

  await audit({
    action: "site_order.converted",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "site_order",
    resourceId: id,
    metadata: {
      sales_count: inserted.length,
      total_cents: order.totalCents,
      sale_ids: (inserted as Array<{ id: string }>).map((s) => s.id),
    },
  });

  refresh();
  return {
    ok: true,
    order: { ...order, status: "confirmado", convertedAt },
    salesCreated: inserted.length,
  };
}
