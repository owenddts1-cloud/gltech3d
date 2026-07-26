"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { saveItemsSchema } from "@/lib/schemas/service-order-documents";
import type { DraftItem } from "@/app/app/service-orders/_lib/document-draft";

/**
 * Itens de uma O.S. (migration 0068).
 *
 * `service_orders.total_cents`/`qty` são recalculados pelas triggers
 * statement-level `trg_service_order_items_recalc_*` — nenhuma action escreve
 * esses campos à mão. Por isso `saveServiceOrderItems` faz *replace-set* em no
 * máximo 2 statements (um DELETE + um UPSERT): cada statement dispara UM recálculo,
 * que por sua vez propaga para a Venda e o Lançamento vinculados (migrations
 * 0065/0066). Salvar item a item multiplicaria essa cascata por N.
 */

interface ItemRow {
  id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  qty: number | string;
  unit_price_cents: number | string;
  image_url: string | null;
  sort_order: number | string;
}

function mapItem(r: ItemRow): DraftItem {
  return {
    id: r.id,
    productId: r.product_id,
    name: r.name,
    description: r.description ?? "",
    qty: Number(r.qty ?? 1),
    unitPriceCents: Number(r.unit_price_cents ?? 0),
    imageUrl: r.image_url,
  };
}

const ITEM_COLUMNS = "id, product_id, name, description, qty, unit_price_cents, image_url, sort_order";

async function ctx() {
  const authUser = await loadAuthUser();
  if (!authUser) return null;
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return null;
  return { userId: authUser.id, orgId: activeOrg.orgId, supabase: await createClient() };
}

export async function fetchServiceOrderItems(serviceOrderId: string) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  const { data, error } = await c.supabase
    .from("service_order_items")
    .select(ITEM_COLUMNS)
    .eq("organization_id", c.orgId)
    .eq("service_order_id", serviceOrderId)
    .order("sort_order", { ascending: true });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, items: ((data as ItemRow[] | null) ?? []).map(mapItem) };
}

/**
 * Substitui o conjunto de itens da O.S. pelo que veio da tela.
 *
 * Itens com `id` são preservados (mantêm created_at/created_by e o histórico de
 * audit); itens sem `id` nascem agora; o que sumiu da lista é apagado. A ordem da
 * lista vira `sort_order`.
 */
export async function saveServiceOrderItems(raw: unknown) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  const parsed = saveItemsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const { serviceOrderId, items } = parsed.data;

  // A O.S. precisa ser desta org. A FK composta do banco já barraria o vínculo
  // cruzado, mas errar aqui em voz alta é melhor do que depender só dela.
  const { data: order, error: orderErr } = await c.supabase
    .from("service_orders")
    .select("id")
    .eq("organization_id", c.orgId)
    .eq("id", serviceOrderId)
    .maybeSingle();
  if (orderErr) return { ok: false as const, error: orderErr.message };
  if (!order) return { ok: false as const, error: "O.S. não encontrada" };

  const keepIds = items.map((i) => i.id).filter((id): id is string => id !== null);

  // 1º statement: remove o que saiu da lista.
  const del = c.supabase
    .from("service_order_items")
    .delete()
    .eq("organization_id", c.orgId)
    .eq("service_order_id", serviceOrderId);
  const { error: delErr } = await (keepIds.length > 0
    ? del.not("id", "in", `(${keepIds.join(",")})`)
    : del);
  if (delErr) return { ok: false as const, error: delErr.message };

  // 2º statement: grava tudo que ficou, novos e existentes de uma vez só.
  if (items.length > 0) {
    const rows = items.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      organization_id: c.orgId,
      service_order_id: serviceOrderId,
      product_id: item.productId,
      name: item.name,
      description: item.description || null,
      qty: item.qty,
      unit_price_cents: item.unitPriceCents,
      image_url: item.imageUrl,
      sort_order: index,
      created_by: c.userId,
    }));
    const { error: upsertErr } = await c.supabase
      .from("service_order_items")
      .upsert(rows, { onConflict: "id" });
    if (upsertErr) return { ok: false as const, error: upsertErr.message };
  }

  const refreshed = await c.supabase
    .from("service_order_items")
    .select(ITEM_COLUMNS)
    .eq("organization_id", c.orgId)
    .eq("service_order_id", serviceOrderId)
    .order("sort_order", { ascending: true });
  if (refreshed.error) return { ok: false as const, error: refreshed.error.message };

  const { data: totals } = await c.supabase
    .from("service_orders")
    .select("total_cents, qty")
    .eq("organization_id", c.orgId)
    .eq("id", serviceOrderId)
    .maybeSingle();

  revalidatePath("/app/service-orders");
  revalidatePath(`/app/service-orders/${serviceOrderId}/documentos`);
  return {
    ok: true as const,
    items: ((refreshed.data as ItemRow[] | null) ?? []).map(mapItem),
    orderTotalCents: Number(totals?.total_cents ?? 0),
    orderQty: Number(totals?.qty ?? 1),
  };
}

/**
 * Reescreve `service_orders.total_cents` pela soma dos itens.
 *
 * Existe porque as triggers de sincronização das migrations 0065/0066 permitem
 * que uma edição feita em Vendas ou no Controle sobrescreva o total da O.S.,
 * deixando-o divergente da soma das linhas. O UPDATE abaixo é no-op mexendo em
 * `updated_at` — o recálculo real é feito pela trigger de itens, então basta tocar
 * uma linha de item para reconciliar.
 */
export async function recalcServiceOrderTotalFromItems(serviceOrderId: string) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  const { data: items, error: itemsErr } = await c.supabase
    .from("service_order_items")
    .select("qty, unit_price_cents")
    .eq("organization_id", c.orgId)
    .eq("service_order_id", serviceOrderId);
  if (itemsErr) return { ok: false as const, error: itemsErr.message };
  if (!items || items.length === 0) {
    return { ok: false as const, error: "A O.S. não tem itens para recalcular." };
  }

  const totalCents = items.reduce(
    (acc, i) => acc + Math.round(Number(i.qty ?? 0) * Number(i.unit_price_cents ?? 0)),
    0,
  );
  const qty = Math.max(1, Math.round(items.reduce((acc, i) => acc + Number(i.qty ?? 0), 0)));

  const { error } = await c.supabase
    .from("service_orders")
    .update({ total_cents: totalCents, qty, updated_at: new Date().toISOString() })
    .eq("organization_id", c.orgId)
    .eq("id", serviceOrderId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/service-orders");
  revalidatePath(`/app/service-orders/${serviceOrderId}/documentos`);
  return { ok: true as const, totalCents, qty };
}
