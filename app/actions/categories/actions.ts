"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { categoryCreateSchema, categoryPatchSchema } from "@/lib/schemas/categories";
import { autoSlug } from "@/lib/slug";
import { revalidatePath } from "next/cache";

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  sortOrder: number | null;
}

interface CatRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number | null;
}

function toView(r: CatRow): CategoryView {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    sortOrder: r.sort_order,
  };
}

export async function fetchCategories() {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "Nenhuma organização ativa" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) return { ok: false as const, error: error.message };

  return {
    ok: true as const,
    categories: ((data as CatRow[] | null) ?? []).map(toView),
  };
}

export async function createCategory(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "Nenhuma organização ativa" };

  const parsed = categoryCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    organization_id: activeOrg.orgId,
    name: d.name,
    slug: d.slug || autoSlug(d.name),
    sort_order: d.sortOrder ?? null,
    created_by: authUser.id,
  });
  if (error) {
    if (error.message.includes("categories_org_slug_unique")) {
      return { ok: false as const, error: "Já existe uma categoria com esse slug." };
    }
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/app/products");
  return { ok: true as const };
}

export async function updateCategory(id: string, raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "Nenhuma organização ativa" };

  const parsed = categoryPatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const patch: Record<string, unknown> = {};
  if (d.name !== undefined) {
    patch.name = d.name;
    if (!d.slug) patch.slug = autoSlug(d.name);
  }
  if (d.slug !== undefined) patch.slug = d.slug;
  if (d.sortOrder !== undefined) patch.sort_order = d.sortOrder;

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update(patch)
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/products");
  return { ok: true as const };
}

export async function deleteCategory(id: string) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "Nenhuma organização ativa" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("organization_id", activeOrg.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/products");
  return { ok: true as const };
}
