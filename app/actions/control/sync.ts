"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { planControlSync, type SyncSourceRow } from "@/app/app/control/_lib/sync-map";
import { revalidatePath } from "next/cache";

export interface SyncResult {
  salesCreated: number;
  salesUpdated: number;
  contactsCreated: number;
  osCreated: number;
  osUpdated: number;
  toolsCreated: number;
  consumablesCreated: number;
  /** Vendas do plano que já existiam (idempotência). */
  alreadySynced: number;
}

const lc = (s: string) => s.trim().toLowerCase();

/**
 * Sincroniza a planilha de Controle com os módulos de domínio (manual, via botão).
 * Idempotente: rodar de novo não duplica — deduplica contra o que já existe.
 */
export async function syncControlToModules(): Promise<
  { ok: false; error: string } | { ok: true; result: SyncResult }
> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };
  const org = activeOrg.orgId;
  const supabase = await createClient();

  // ── Origem: linhas da planilha ──
  const { data: finData, error: finErr } = await supabase
    .from("financial_records")
    .select("id, date, description, type, category, platform, revenue_cents, expense_cents, quantity")
    .eq("organization_id", org);
  if (finErr) return { ok: false, error: finErr.message };

  const plan = planControlSync((finData as SyncSourceRow[] | null) ?? []);

  const result: SyncResult = {
    salesCreated: 0, salesUpdated: 0, contactsCreated: 0, osCreated: 0, osUpdated: 0,
    toolsCreated: 0, consumablesCreated: 0, alreadySynced: 0,
  };

  // ── Contatos (dedup por nome) ──
  const nameToContactId = new Map<string, string>();
  if (plan.contactNames.length > 0) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id, name, display_name")
      .eq("organization_id", org);
    for (const c of (existing as Array<{ id: string; name: string | null; display_name: string | null }> | null) ?? []) {
      const key = lc(c.display_name || c.name || "");
      if (key) nameToContactId.set(key, c.id);
    }
    const missing = plan.contactNames.filter((n) => !nameToContactId.has(lc(n)));
    if (missing.length > 0) {
      const { data: inserted, error } = await supabase
        .from("contacts")
        .insert(missing.map((n) => ({
          organization_id: org, name: n, display_name: n, source: "controle", created_by_user_id: authUser.id,
        })))
        .select("id, display_name");
      if (error) return { ok: false, error: `contatos: ${error.message}` };
      for (const c of (inserted as Array<{ id: string; display_name: string | null }> | null) ?? []) {
        if (c.display_name) nameToContactId.set(lc(c.display_name), c.id);
      }
      result.contactsCreated = inserted?.length ?? 0;
    }
  }

  // ── Vendas → marketplace_orders (dedup por external_order_id = ctrl:<id>) ──
  interface OrderRow { id: string; external_order_id: string | null; service_order_id: string | null; customer_name: string | null; total_cents: number | string }
  const orderByKey = new Map<string, OrderRow>();
  if (plan.sales.length > 0) {
    const keys = plan.sales.map((s) => s.key);
    const { data: existingOrders } = await supabase
      .from("marketplace_orders")
      .select("id, external_order_id, service_order_id, customer_name, total_cents")
      .eq("organization_id", org)
      .in("external_order_id", keys);
    for (const o of (existingOrders as OrderRow[] | null) ?? []) {
      if (o.external_order_id) orderByKey.set(o.external_order_id, o);
    }
    result.alreadySynced = orderByKey.size;

    // Atualiza pedidos JÁ existentes (re-sync corrige dados de uma sincronização anterior:
    // ex. produto/cliente separados, plataforma, valor).
    for (const s of plan.sales) {
      const order = orderByKey.get(s.key);
      if (!order) continue;
      await supabase.from("marketplace_orders").update({
        platform: s.platform, customer_name: s.customerName, total_cents: s.totalCents, sold_at: s.soldAt,
      }).eq("organization_id", org).eq("id", order.id);
      order.customer_name = s.customerName;
      order.total_cents = s.totalCents;
      result.salesUpdated += 1;
    }

    const newSales = plan.sales.filter((s) => !orderByKey.has(s.key));
    if (newSales.length > 0) {
      const { data: inserted, error } = await supabase
        .from("marketplace_orders")
        .insert(newSales.map((s) => ({
          organization_id: org, platform: s.platform, external_order_id: s.key,
          customer_name: s.customerName, status: "pago", total_cents: s.totalCents,
          sold_at: s.soldAt, created_by: authUser.id,
        })))
        .select("id, external_order_id, service_order_id, customer_name, total_cents");
      if (error) return { ok: false, error: `vendas: ${error.message}` };
      for (const o of (inserted as OrderRow[] | null) ?? []) {
        if (o.external_order_id) orderByKey.set(o.external_order_id, o);
      }
      result.salesCreated = inserted?.length ?? 0;
    }

    // ── O.S. a partir das vendas: título = produto, contato = cliente, valor = venda.
    // Cria se ainda não há O.S. ligada; atualiza a existente no re-sync. ──
    for (const s of plan.sales) {
      const order = orderByKey.get(s.key);
      if (!order) continue;
      const contactId = nameToContactId.get(lc(s.customerName)) ?? null;
      if (order.service_order_id) {
        await supabase.from("service_orders").update({
          title: s.osTitle, contact_id: contactId, contact_name: s.customerName, total_cents: s.totalCents,
          updated_at: new Date().toISOString(),
        }).eq("organization_id", org).eq("id", order.service_order_id);
        result.osUpdated += 1;
        continue;
      }
      const { data: os, error: osErr } = await supabase
        .from("service_orders")
        .insert({
          organization_id: org, title: s.osTitle, contact_id: contactId,
          contact_name: s.customerName, status: "aprovado",
          total_cents: s.totalCents, qty: 1, created_by: authUser.id,
        })
        .select("id")
        .single();
      if (osErr) return { ok: false, error: `O.S.: ${osErr.message}` };
      const osId = (os as { id: string } | null)?.id;
      if (osId) {
        await supabase.from("marketplace_orders").update({ service_order_id: osId }).eq("organization_id", org).eq("id", order.id);
        order.service_order_id = osId;
        result.osCreated += 1;
      }
    }
  }

  // ── Ferramentas → inventory_assets (dedup por nome, category 'ferramenta') ──
  if (plan.tools.length > 0) {
    const { data: existingTools } = await supabase
      .from("inventory_assets")
      .select("name")
      .eq("organization_id", org)
      .eq("category", "ferramenta");
    const have = new Set(((existingTools as Array<{ name: string }> | null) ?? []).map((t) => lc(t.name)));
    const newTools = plan.tools.filter((t) => !have.has(lc(t.name)));
    if (newTools.length > 0) {
      const { error } = await supabase.from("inventory_assets").insert(newTools.map((t) => ({
        organization_id: org, name: t.name, category: "ferramenta", quantity: t.quantity,
        purchase_value_cents: t.purchaseValueCents, purchase_date: t.purchaseDate, status: "ativo", created_by: authUser.id,
      })));
      if (error) return { ok: false, error: `ferramentas: ${error.message}` };
      result.toolsCreated = newTools.length;
    }
  }

  // ── Filamentos → consumables (dedup por nome) ──
  if (plan.consumables.length > 0) {
    const { data: existingCons } = await supabase
      .from("consumables")
      .select("name")
      .eq("organization_id", org);
    const have = new Set(((existingCons as Array<{ name: string }> | null) ?? []).map((c) => lc(c.name)));
    const newCons = plan.consumables.filter((c) => !have.has(lc(c.name)));
    if (newCons.length > 0) {
      const { error } = await supabase.from("consumables").insert(newCons.map((c) => ({
        organization_id: org, name: c.name, category: "filamento",
        stock_grams: c.stockGrams, cost_per_kg_cents: c.costPerKgCents, created_by: authUser.id,
      })));
      if (error) return { ok: false, error: `consumíveis: ${error.message}` };
      result.consumablesCreated = newCons.length;
    }
  }

  revalidatePath("/app/sales");
  revalidatePath("/app/contacts");
  revalidatePath("/app/service-orders");
  revalidatePath("/app/inventory");
  revalidatePath("/app/calendar");
  return { ok: true, result };
}
