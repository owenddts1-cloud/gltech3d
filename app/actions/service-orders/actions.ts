"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import {
  serviceOrderCreateSchema,
  serviceOrderPatchSchema,
  serviceOrderMoveSchema,
  type SoStatus,
  type SoPriority,
} from "@/lib/schemas/service-orders";
import { revalidatePath } from "next/cache";
import { fetchSaleChannelOptions } from "@/app/actions/sale-channels/actions";
import { fetchMaterialOptions } from "@/app/actions/materials/actions";

export interface ServiceOrderView {
  id: string;
  code: string | null;
  title: string;
  contactId: string | null;
  contactName: string | null;
  status: SoStatus;
  priority: SoPriority;
  material: string | null;
  channelId: string | null;
  totalCents: number;
  qty: number;
  slaDueAt: string | null;
  slicerNotes: { notes?: string; layerHeight?: number; infill?: number; supports?: boolean };
  position: number;
  createdAt: string;
  /** > 0 significa que totalCents/qty são derivados dos itens (migration 0068). */
  itemsCount: number;
  documentsCount: number;
}

interface SoRow {
  id: string; code: string | null; title: string; contact_id: string | null; contact_name: string | null;
  status: SoStatus; priority: SoPriority | null; material: string | null; channel_id: string | null;
  total_cents: number | string; qty: number | string; sla_due_at: string | null;
  slicer_notes: unknown; position: number | string; created_at: string;
  service_order_items?: Array<{ count: number }> | null;
  service_order_documents?: Array<{ count: number }> | null;
}

/** `select("…, tabela(count)")` devolve `[{ count: n }]` ou `[]` — normaliza. */
function relCount(rel: Array<{ count: number }> | null | undefined): number {
  return Number(rel?.[0]?.count ?? 0);
}

function mapRow(r: SoRow): ServiceOrderView {
  return {
    id: r.id,
    code: r.code ?? null,
    title: r.title,
    contactId: r.contact_id,
    contactName: r.contact_name,
    status: r.status,
    priority: r.priority ?? "media",
    material: r.material ?? null,
    channelId: r.channel_id ?? null,
    totalCents: Number(r.total_cents ?? 0),
    qty: Number(r.qty ?? 1),
    slaDueAt: r.sla_due_at,
    slicerNotes: (r.slicer_notes as ServiceOrderView["slicerNotes"]) ?? {},
    position: Number(r.position ?? 0),
    createdAt: r.created_at,
    itemsCount: relCount(r.service_order_items),
    documentsCount: relCount(r.service_order_documents),
  };
}

export async function fetchServiceOrdersData() {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();
  const [ordersRes, contactsRes, channelsRes, materialsRes] = await Promise.all([
    supabase
      .from("service_orders")
      .select("*, service_order_items(count), service_order_documents(count)")
      .order("status", { ascending: true })
      .order("position", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("id, name")
      .eq("organization_id", activeOrg.orgId)
      .order("name", { ascending: true })
      .limit(300),
    fetchSaleChannelOptions(),
    fetchMaterialOptions(),
  ]);

  return {
    ok: true as const,
    orgId: activeOrg.orgId,
    orders: ((ordersRes.data as SoRow[] | null) ?? []).map(mapRow),
    contacts: (contactsRes.data as Array<{ id: string; name: string | null }> | null) ?? [],
    saleChannels: channelsRes.ok ? channelsRes.channels : [],
    materials: materialsRes.ok ? materialsRes.materials : [],
  };
}

function buildSlicerNotes(input: {
  notes?: string; layerHeight?: number; infill?: number; supports?: boolean;
}): Record<string, unknown> {
  const n: Record<string, unknown> = {};
  if (input.notes) n.notes = input.notes;
  if (input.layerHeight !== undefined) n.layerHeight = input.layerHeight;
  if (input.infill !== undefined) n.infill = input.infill;
  if (input.supports !== undefined) n.supports = input.supports;
  return n;
}

export async function createServiceOrder(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = serviceOrderCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_orders")
    .insert({
      organization_id: activeOrg.orgId,
      title: d.title,
      contact_id: d.contactId ?? null,
      contact_name: d.contactName || null,
      status: d.status,
      priority: d.priority,
      material: d.material ?? null,
      channel_id: d.channelId ?? null,
      total_cents: Math.round((d.total ?? 0) * 100),
      qty: d.qty,
      sla_due_at: d.slaDueAt ?? null,
      slicer_notes: buildSlicerNotes(d),
      created_by: authUser.id,
    })
    .select("*")
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/service-orders");
  return { ok: true as const, order: mapRow(data as SoRow) };
}

export async function updateServiceOrderStatus(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = serviceOrderMoveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_orders")
    .update({ status: parsed.data.status, position: parsed.data.position, updated_at: new Date().toISOString() })
    .eq("organization_id", activeOrg.orgId)
    .eq("id", parsed.data.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/service-orders");
  return { ok: true as const };
}

export async function updateServiceOrder(id: string, raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const parsed = serviceOrderPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();

  // Quando a O.S. tem itens (migration 0068), total_cents e qty são DERIVADOS da
  // soma das linhas pelas triggers de recálculo. Aceitar o valor do formulário
  // aqui faria o dialog — que mostra o total só de leitura — sobrescrever o
  // cálculo com o número antigo em cada "Salvar". Ignora os dois campos.
  const { count: itemsCount } = await supabase
    .from("service_order_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", activeOrg.orgId)
    .eq("service_order_id", id);
  const derivedFromItems = (itemsCount ?? 0) > 0;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (d.title !== undefined) patch.title = d.title;
  if (d.contactId !== undefined) patch.contact_id = d.contactId;
  if (d.contactName !== undefined) patch.contact_name = d.contactName || null;
  if (d.status !== undefined) patch.status = d.status;
  if (d.priority !== undefined) patch.priority = d.priority;
  if (d.material !== undefined) patch.material = d.material ?? null;
  if (d.channelId !== undefined) patch.channel_id = d.channelId ?? null;
  if (!derivedFromItems && d.total !== undefined) patch.total_cents = Math.round(d.total * 100);
  if (!derivedFromItems && d.qty !== undefined) patch.qty = d.qty;
  if (d.notes !== undefined || d.layerHeight !== undefined || d.infill !== undefined || d.supports !== undefined) {
    const { data: existingSo } = await supabase
      .from("service_orders")
      .select("slicer_notes")
      .eq("organization_id", activeOrg.orgId)
      .eq("id", id)
      .single();
    const currentNotes = (existingSo?.slicer_notes as Record<string, unknown>) ?? {};
    patch.slicer_notes = {
      ...currentNotes,
      ...buildSlicerNotes(d),
    };
  }

  const { error } = await supabase
    .from("service_orders")
    .update(patch)
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/service-orders");
  // `derivedFromItems` avisa a UI para não aplicar o total do formulário de forma
  // otimista — o valor real veio dos itens.
  return { ok: true as const, derivedFromItems };
}

export async function deleteServiceOrder(id: string) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_orders")
    .delete()
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/service-orders");
  return { ok: true as const };
}
