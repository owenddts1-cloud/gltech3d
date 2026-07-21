"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { materialQuickCreateSchema } from "@/lib/schemas/materials";
import { autoSlug } from "@/lib/slug";
import { revalidatePath } from "next/cache";

export interface MaterialOption {
  id: string;
  name: string;
}

interface MaterialRow {
  id: string;
  name: string;
}

function toOption(r: MaterialRow): MaterialOption {
  return { id: r.id, name: r.name };
}

export async function fetchMaterialOptions() {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "Nenhuma organização ativa" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .select("id, name")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, materials: ((data as MaterialRow[] | null) ?? []).map(toOption) };
}

/**
 * Cria um material "rápido" (catálogo de sugestões, não é FK — service_orders.material
 * continua text livre). Dedup por nome (case-insensitive).
 */
export async function quickCreateMaterial(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "Nenhuma organização ativa" };

  const parsed = materialQuickCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Nome inválido" };
  }
  const name = parsed.data.name;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("materials")
    .select("id, name")
    .eq("organization_id", activeOrg.orgId)
    .ilike("name", name)
    .limit(1);
  const found = (existing as MaterialRow[] | null)?.[0];
  if (found) return { ok: true as const, material: toOption(found), existed: true as const };

  const { data, error } = await supabase
    .from("materials")
    .insert({
      organization_id: activeOrg.orgId,
      name,
      slug: autoSlug(name),
      created_by: authUser.id,
    })
    .select("id, name")
    .single();
  if (error) {
    if (error.message.includes("materials_org_slug_unique")) {
      return { ok: false as const, error: "Já existe um material com esse nome." };
    }
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/app/service-orders");
  return { ok: true as const, material: toOption(data as MaterialRow), existed: false as const };
}
