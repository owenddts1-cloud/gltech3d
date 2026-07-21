"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { saleChannelQuickCreateSchema } from "@/lib/schemas/sale-channels";
import { autoSlug } from "@/lib/slug";
import { revalidatePath } from "next/cache";

export interface SaleChannelOption {
  id: string;
  name: string;
}

interface ChannelRow {
  id: string;
  name: string;
}

function toOption(r: ChannelRow): SaleChannelOption {
  return { id: r.id, name: r.name };
}

export async function fetchSaleChannelOptions() {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "Nenhuma organização ativa" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sale_channels")
    .select("id, name")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, channels: ((data as ChannelRow[] | null) ?? []).map(toOption) };
}

/**
 * Cria um canal de venda "rápido". Dedup por nome (case-insensitive):
 * se já existir, retorna o existente em vez de duplicar.
 */
export async function quickCreateSaleChannel(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "Nenhuma organização ativa" };

  const parsed = saleChannelQuickCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Nome inválido" };
  }
  const name = parsed.data.name;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("sale_channels")
    .select("id, name")
    .eq("organization_id", activeOrg.orgId)
    .ilike("name", name)
    .limit(1);
  const found = (existing as ChannelRow[] | null)?.[0];
  if (found) return { ok: true as const, channel: toOption(found), existed: true as const };

  const { data, error } = await supabase
    .from("sale_channels")
    .insert({
      organization_id: activeOrg.orgId,
      name,
      slug: autoSlug(name),
      created_by: authUser.id,
    })
    .select("id, name")
    .single();
  if (error) {
    if (error.message.includes("sale_channels_org_slug_unique")) {
      return { ok: false as const, error: "Já existe um canal com esse nome." };
    }
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/app/sales");
  revalidatePath("/app/service-orders");
  return { ok: true as const, channel: toOption(data as ChannelRow), existed: false as const };
}
