/**
 * Abas personalizadas do Controle (`control_sheets`, migration 0086): formato
 * da grade (lib/control/sheets.ts) e drift entre migration e baseline.
 * Isolamento entre tenants e o CHECK de tamanho sao provados sob RLS de verdade
 * em scripts/verify-baseline.sh.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  SHEET_MAX_CELLS_BYTES,
  SHEET_MAX_COLS,
  SHEET_MAX_ROWS,
  cellsJsonBytes,
  normalizeSheetCells,
  parseStoredCells,
  setSheetCell,
  sheetCellsSchema,
  sheetNameSchema,
  visibleGridSize,
} from "@/lib/control/sheets";

describe("formato da grade", () => {
  it("normaliza buracos e corta linhas/celulas vazias no fim", () => {
    const sparse: (string[] | undefined)[] = [];
    sparse[2] = ["a", "", ""];
    sparse[4] = ["", "", ""];
    expect(normalizeSheetCells(sparse)).toEqual([[], [], ["a"]]);
    expect(normalizeSheetCells([])).toEqual([]);
  });

  it("setSheetCell nao muta a grade original", () => {
    const original = [["x"]];
    const next = setSheetCell(original, 2, 1, "y");
    expect(original).toEqual([["x"]]);
    expect(next).toEqual([["x"], [], ["", "y"]]);
  });

  it("limites: 200 linhas, 30 colunas, 500 caracteres", () => {
    expect(sheetCellsSchema.safeParse(Array.from({ length: SHEET_MAX_ROWS }, () => [""])).success).toBe(true);
    expect(sheetCellsSchema.safeParse(Array.from({ length: SHEET_MAX_ROWS + 1 }, () => [""])).success).toBe(false);
    expect(sheetCellsSchema.safeParse([Array(SHEET_MAX_COLS + 1).fill("")]).success).toBe(false);
    expect(sheetCellsSchema.safeParse([["x".repeat(501)]]).success).toBe(false);
    expect(sheetCellsSchema.safeParse([[1]]).success).toBe(false);
  });

  it("a grade cheia no limite passa do CHECK de 1 MB — o servidor precisa medir antes", () => {
    const full = Array.from({ length: SHEET_MAX_ROWS }, () => Array(SHEET_MAX_COLS).fill("x".repeat(500)));
    expect(sheetCellsSchema.safeParse(full).success).toBe(true);
    expect(cellsJsonBytes(full)).toBeGreaterThan(SHEET_MAX_CELLS_BYTES);
  });

  it("nome entre 1 e 60 caracteres, sem espacos nas pontas", () => {
    expect(sheetNameSchema.safeParse("  Compras  ").data).toBe("Compras");
    expect(sheetNameSchema.safeParse("   ").success).toBe(false);
    expect(sheetNameSchema.safeParse("x".repeat(61)).success).toBe(false);
  });

  it("conteudo invalido vindo do banco vira grade vazia em vez de quebrar a tela", () => {
    expect(parseStoredCells({ not: "an array" })).toEqual([]);
    expect(parseStoredCells([["ok"]])).toEqual([["ok"]]);
  });

  it("grade visivel tem pelo menos 50x10 e no maximo os limites", () => {
    expect(visibleGridSize([])).toEqual({ rows: 50, cols: 10 });
    expect(visibleGridSize([Array(14).fill("a")])).toEqual({ rows: 50, cols: 14 });
  });
});

const ROOT = path.resolve(__dirname, "../..");
const norm = (s: string) => s.toLowerCase().replace(/\r\n/g, "\n");
const MIGRATION = norm(
  readFileSync(path.join(ROOT, "supabase/migrations/20261007140000_0086_control_sheets.sql"), "utf8"),
);
const BASELINE = norm(readFileSync(path.join(ROOT, "supabase/baseline.sql"), "utf8"));
const baselineBlock = BASELINE.slice(BASELINE.indexOf("(migration 0086) ----"));

describe("0086 — migration e apendice do baseline andam juntos", () => {
  it("o baseline contem o bloco da 0086", () => {
    expect(BASELINE.indexOf("(migration 0086) ----")).toBeGreaterThan(-1);
  });

  it.each([
    ["migration 0086", MIGRATION],
    ["apendice do baseline", baselineBlock],
  ])("%s cria tabela, RLS, policies por comando, CHECKs e gatilhos", (_label, sql) => {
    expect(sql).toContain("create table if not exists public.control_sheets");
    expect(sql).toContain("organization_id uuid not null references public.organizations(id) on delete cascade");
    expect(sql).toContain("position        numeric not null default 0");
    expect(sql).toContain("alter table public.control_sheets enable row level security");
    for (const cmd of ["select", "insert", "update", "delete"]) {
      expect(sql).toContain(`create policy tenant_isolation_control_sheets_${cmd}`);
    }
    expect(sql).toContain("check (char_length(name) between 1 and 60)");
    expect(sql).toContain("check (octet_length(cells::text) < 1000000)");
    expect(sql).toContain("control_sheets_org_position_idx");
    expect(sql).toContain("execute function public.fn_set_updated_at()");
    // auditoria so de criar/apagar/renomear, nunca do autosave de celulas
    expect(sql).toContain("after insert or delete or update of name on public.control_sheets");
  });

  it.each([
    ["migration 0086", MIGRATION],
    ["apendice do baseline", baselineBlock],
  ])("%s: leitura para membro, escrita so agent+ e autoria nao forjavel", (_label, sql) => {
    const policy = (cmd: string) => {
      const start = sql.indexOf(`create policy tenant_isolation_control_sheets_${cmd}`);
      return sql.slice(start, sql.indexOf(";", start));
    };
    expect(policy("select")).toContain("fn_user_org_ids()");
    for (const cmd of ["insert", "update", "delete"]) {
      expect(policy(cmd), cmd).toContain("public.fn_role_at_least(organization_id, 'agent')");
      expect(policy(cmd), cmd).not.toContain("fn_user_org_ids");
    }
    expect(policy("insert")).toContain("created_by is null or created_by = auth.uid()");
    expect(sql).toContain("alter column created_by set default auth.uid()");
    expect(sql).toContain("new.created_by := old.created_by");
    expect(sql).toContain("before update on public.control_sheets\n  for each row execute function public.fn_control_sheets_keep_created_by()");
  });
});
