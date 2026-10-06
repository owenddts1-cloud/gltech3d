"use server";

/**
 * Custom spreadsheet tabs of the Controle screen (table `control_sheets`,
 * migration 0086). Before this they lived in the browser's localStorage only.
 *
 * Every query filters `organization_id` explicitly on top of RLS, the org comes
 * from the session (never from the caller), and writes go through the PRO gate.
 * An UPDATE/DELETE that matches zero rows is reported as an error: under RLS
 * a foreign or missing id does not raise, it just changes nothing.
 */
import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { assertProAccess } from "@/lib/plan/server";
import { logger } from "@/lib/logger";
import {
  SHEET_MAX_CELLS_BYTES,
  SHEET_MAX_PER_ORG,
  cellsJsonBytes,
  parseStoredCells,
  parseStoredColumns,
  sheetCellsSchema,
  sheetColumnsSchema,
  sheetIdSchema,
  sheetNameSchema,
  type ControlSheet,
} from "@/lib/control/sheets";

type Fail = { ok: false; error: string };

interface Ctx {
  orgId: string;
  userId: string;
  /** Agent+ or platform admin — mirrors the write policies of migration 0086. */
  canWrite: boolean;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

const READ_ONLY = "Seu perfil (leitor) só pode visualizar as abas. Peça a um atendente, gerente ou administrador para editar.";

interface SheetRow {
  id: string;
  name: string;
  position: number | string;
  cells: unknown;
  columns: unknown;
  updated_at: string;
}

const SHEET_COLUMNS = "id, name, position, cells, columns, updated_at";
const NOT_FOUND = "Aba não encontrada — ela pode ter sido removida em outra janela.";

function toSheet(row: SheetRow): ControlSheet {
  return {
    id: row.id,
    name: row.name,
    position: Number(row.position),
    cells: parseStoredCells(row.cells),
    columns: parseStoredColumns(row.columns),
    updatedAt: row.updated_at,
  };
}

/** Session + active org, for reads. */
async function readCtx(): Promise<{ ok: true; ctx: Ctx } | Fail> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa." };
  const canWrite = authUser.is_platform_admin || ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent;
  return {
    ok: true,
    ctx: { orgId: activeOrg.orgId, userId: authUser.id, canWrite, supabase: await createClient() },
  };
}

/**
 * Same as readCtx plus role (agent+) and the PRO gate — every write goes
 * through here. RLS refuses a viewer anyway; checking first gives a clear
 * message instead of "nothing changed".
 */
async function requireCtx(): Promise<{ ok: true; ctx: Ctx } | Fail> {
  const c = await readCtx();
  if (!c.ok) return c;
  if (!c.ctx.canWrite) return { ok: false, error: READ_ONLY };
  const denied = await assertProAccess(c.ctx.orgId);
  if (denied) return { ok: false, error: denied };
  return c;
}

function dbError(op: string, message: string): Fail {
  logger.error("control_sheets_db_error", { op, details: message });
  return { ok: false, error: "Não foi possível salvar a aba. Tente novamente." };
}

export async function listControlSheets(): Promise<
  { ok: true; sheets: ControlSheet[]; canEdit: boolean } | Fail
> {
  const c = await readCtx();
  if (!c.ok) return c;
  const { data, error } = await c.ctx.supabase
    .from("control_sheets")
    .select(SHEET_COLUMNS)
    .eq("organization_id", c.ctx.orgId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(SHEET_MAX_PER_ORG);
  if (error) {
    logger.error("control_sheets_db_error", { op: "list", details: error.message });
    return { ok: false, error: "Não foi possível carregar as abas personalizadas." };
  }
  return { ok: true, sheets: ((data ?? []) as SheetRow[]).map(toSheet), canEdit: c.ctx.canWrite };
}

export async function createControlSheet(rawName: unknown): Promise<{ ok: true; sheet: ControlSheet } | Fail> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const name = sheetNameSchema.safeParse(rawName);
  if (!name.success) return { ok: false, error: name.error.issues[0]?.message ?? "Nome inválido" };

  const { data: existing, error: listErr } = await c.ctx.supabase
    .from("control_sheets")
    .select("position")
    .eq("organization_id", c.ctx.orgId)
    .order("position", { ascending: false })
    .limit(SHEET_MAX_PER_ORG);
  if (listErr) return dbError("create.list", listErr.message);
  const rows = (existing ?? []) as { position: number | string }[];
  if (rows.length >= SHEET_MAX_PER_ORG) {
    return { ok: false, error: `Limite de ${SHEET_MAX_PER_ORG} abas personalizadas atingido.` };
  }
  const nextPosition = rows.length > 0 ? Number(rows[0]!.position) + 1 : 0;

  const { data, error } = await c.ctx.supabase
    .from("control_sheets")
    .insert({
      organization_id: c.ctx.orgId,
      name: name.data,
      position: nextPosition,
      created_by: c.ctx.userId,
    })
    .select(SHEET_COLUMNS)
    .single();
  if (error || !data) return dbError("create", error?.message ?? "no row");
  return { ok: true, sheet: toSheet(data as SheetRow) };
}

export async function renameControlSheet(rawId: unknown, rawName: unknown): Promise<{ ok: true } | Fail> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const id = sheetIdSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: "Aba inválida" };
  const name = sheetNameSchema.safeParse(rawName);
  if (!name.success) return { ok: false, error: name.error.issues[0]?.message ?? "Nome inválido" };

  const { data, error } = await c.ctx.supabase
    .from("control_sheets")
    .update({ name: name.data })
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id.data)
    .select("id");
  if (error) return dbError("rename", error.message);
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };
  return { ok: true };
}

export async function deleteControlSheet(rawId: unknown): Promise<{ ok: true } | Fail> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const id = sheetIdSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: "Aba inválida" };

  const { data, error } = await c.ctx.supabase
    .from("control_sheets")
    .delete()
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id.data)
    .select("id");
  if (error) return dbError("delete", error.message);
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };
  return { ok: true };
}

export async function saveControlSheetCells(
  rawId: unknown,
  rawCells: unknown,
  rawColumns?: unknown,
): Promise<{ ok: true; updatedAt: string } | Fail> {
  const c = await requireCtx();
  if (!c.ok) return c;
  const id = sheetIdSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: "Aba inválida" };
  const cells = sheetCellsSchema.safeParse(rawCells);
  if (!cells.success) {
    return { ok: false, error: "Planilha fora do limite (até 200 linhas, 30 colunas e 500 caracteres por célula)." };
  }
  if (cellsJsonBytes(cells.data) >= SHEET_MAX_CELLS_BYTES) {
    return { ok: false, error: "Planilha grande demais para salvar (limite de 1 MB de texto)." };
  }

  const patch: { cells: string[][]; columns?: unknown } = { cells: cells.data };
  if (rawColumns !== undefined) {
    const columns = sheetColumnsSchema.nullable().safeParse(rawColumns);
    if (!columns.success) return { ok: false, error: "Colunas inválidas" };
    patch.columns = columns.data;
  }

  const { data, error } = await c.ctx.supabase
    .from("control_sheets")
    .update(patch)
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id.data)
    .select("updated_at");
  if (error) return dbError("save_cells", error.message);
  const row = (data as { updated_at: string }[] | null)?.[0];
  if (!row) return { ok: false, error: NOT_FOUND };
  return { ok: true, updatedAt: row.updated_at };
}
