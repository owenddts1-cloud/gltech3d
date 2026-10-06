"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { deleteDeniedMessage } from "@/lib/auth/delete-policy";
import { assertProAccess } from "@/lib/plan/server";
import {
  projectCreateSchema, projectNoteCreateSchema, projectNotePatchSchema,
  projectUpdateSchema, projectPatchToRow,
  type ProjectNoteColor,
} from "@/lib/schemas/projects";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const idSchema = z.string().uuid();

export interface ProjectView {
  id: string;
  name: string;
  filamentType: string;
  weightGrams: number;
  printHours: number;
  layerHeight: number;
  infill: string;
  speed: number;
  nozzleTemp: number;
  bedTemp: number;
  description: string;
  filamentCostPerKg: number;
  wattage: number;
  kwhPrice: number;
  depreciationPerHour: number;
}

export interface ProjectNoteView {
  id: string;
  title: string;
  content: string;
  color: ProjectNoteColor;
  createdAt: string;
  /** Posição no plano do quadro livre (null = ainda não posicionada). */
  posX: number | null;
  posY: number | null;
}

export interface ProjectsData {
  projects: ProjectView[];
  notes: ProjectNoteView[];
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

interface ProjectRow {
  id: string; name: string; filament_type: string | null; weight_grams: number | string;
  print_hours: number | string; layer_height: number | string; infill: string | null;
  speed: number | string; nozzle_temp: number | string; bed_temp: number | string;
  description: string | null; filament_cost_per_kg: number | string; wattage: number | string;
  kwh_price: number | string; depreciation_per_hour: number | string;
}
interface NoteRow {
  id: string; title: string; content: string; color: ProjectNoteColor; created_at: string;
  pos_x: number | string | null; pos_y: number | string | null;
}

const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

function mapProject(r: ProjectRow): ProjectView {
  return {
    id: r.id,
    name: r.name,
    filamentType: r.filament_type ?? "",
    weightGrams: num(r.weight_grams),
    printHours: num(r.print_hours),
    layerHeight: num(r.layer_height),
    infill: r.infill ?? "",
    speed: num(r.speed),
    nozzleTemp: num(r.nozzle_temp),
    bedTemp: num(r.bed_temp),
    description: r.description ?? "",
    filamentCostPerKg: num(r.filament_cost_per_kg),
    wattage: num(r.wattage),
    kwhPrice: num(r.kwh_price),
    depreciationPerHour: num(r.depreciation_per_hour),
  };
}

export async function fetchProjectsData(): Promise<{ ok: false } | { ok: true; data: ProjectsData }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false };

  const supabase = await createClient();
  const [projRes, notesRes] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("project_notes").select("id, title, content, color, created_at, pos_x, pos_y").order("created_at", { ascending: false }),
  ]);

  return {
    ok: true,
    data: {
      projects: ((projRes.data as ProjectRow[] | null) ?? []).map(mapProject),
      notes: ((notesRes.data as NoteRow[] | null) ?? []).map((n) => ({
        id: n.id, title: n.title, content: n.content, color: n.color, createdAt: n.created_at,
        posX: numOrNull(n.pos_x), posY: numOrNull(n.pos_y),
      })),
    },
  };
}

export async function createProject(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false as const, error: denied };

  const parsed = projectCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({
    organization_id: activeOrg.orgId,
    name: d.name,
    filament_type: d.filamentType || null,
    weight_grams: d.weightGrams,
    print_hours: d.printHours,
    layer_height: d.layerHeight,
    infill: d.infill || null,
    speed: d.speed,
    nozzle_temp: d.nozzleTemp,
    bed_temp: d.bedTemp,
    description: d.description || null,
    filament_cost_per_kg: d.filamentCostPerKg,
    wattage: d.wattage,
    kwh_price: d.kwhPrice,
    depreciation_per_hour: d.depreciationPerHour,
    created_by: authUser.id,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/projects");
  return { ok: true as const };
}

/** Edits a project. Same gates as create; zero matched rows means not found in this org. */
export async function updateProject(id: string, raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false as const, error: denied };

  const idParsed = idSchema.safeParse(id);
  if (!idParsed.success) return { ok: false as const, error: "Projeto inválido" };
  const parsed = projectUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ ...projectPatchToRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("organization_id", activeOrg.orgId)
    .eq("id", idParsed.data)
    .select("id");
  if (error) return { ok: false as const, error: error.message };
  if (!data || data.length === 0) return { ok: false as const, error: "Projeto não encontrado" };

  revalidatePath("/app/projects");
  return { ok: true as const };
}

export async function deleteProject(id: string) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false as const, error: denied };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects").delete()
    .eq("organization_id", activeOrg.orgId).eq("id", id)
    .select("id");
  if (error) return { ok: false as const, error: error.message };
  // RLS (0084): DELETE requires manager+; a denied delete removes 0 rows silently.
  if (!data || data.length === 0) {
    return { ok: false as const, error: deleteDeniedMessage("projects") };
  }

  revalidatePath("/app/projects");
  return { ok: true as const };
}

export async function createProjectNote(raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false as const, error: denied };

  const parsed = projectNoteCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("project_notes").insert({
    organization_id: activeOrg.orgId,
    title: d.title,
    content: d.content,
    color: d.color,
    created_by: authUser.id,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/projects");
  return { ok: true as const };
}

/** Atualiza uma nota: posição no plano (posX/posY ao arrastar) ou texto/cor ao editar. */
export async function updateProjectNote(id: string, raw: unknown) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false as const, error: denied };

  const parsed = projectNotePatchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (d.title !== undefined) patch.title = d.title;
  if (d.content !== undefined) patch.content = d.content;
  if (d.color !== undefined) patch.color = d.color;
  if (d.posX !== undefined) patch.pos_x = d.posX;
  if (d.posY !== undefined) patch.pos_y = d.posY;

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_notes").update(patch)
    .eq("organization_id", activeOrg.orgId).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/projects");
  return { ok: true as const };
}

export async function deleteProjectNote(id: string) {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false as const, error: denied };

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_notes").delete()
    .eq("organization_id", activeOrg.orgId).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/projects");
  return { ok: true as const };
}
