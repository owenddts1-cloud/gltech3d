/**
 * Shape of a custom sheet of the Controle screen (table `control_sheets`,
 * migration 0086). The ONLY definition of what `cells` / `columns` hold — the
 * server actions validate with these schemas and the client normalises with
 * these helpers, so no screen reads the jsonb by an ad-hoc path.
 */
import { z } from "zod";

export const SHEET_MAX_ROWS = 200;
export const SHEET_MAX_COLS = 30;
export const SHEET_MAX_CELL_CHARS = 500;
export const SHEET_NAME_MAX = 60;
/** Max sheets per org. A cap keeps a runaway client from filling the table. */
export const SHEET_MAX_PER_ORG = 50;
/** Same bound as the `control_sheets_cells_size` CHECK in migration 0086. */
export const SHEET_MAX_CELLS_BYTES = 1_000_000;

/** Grid shown for a sheet with fewer rows/cols than this. */
export const SHEET_MIN_VISIBLE_ROWS = 50;
export const SHEET_MIN_VISIBLE_COLS = 10;

export const sheetIdSchema = z.string().uuid();

export const sheetNameSchema = z
  .string()
  .trim()
  .min(1, "Dê um nome à aba")
  .max(SHEET_NAME_MAX, `Nome com no máximo ${SHEET_NAME_MAX} caracteres`);

export const sheetCellsSchema = z
  .array(z.array(z.string().max(SHEET_MAX_CELL_CHARS)).max(SHEET_MAX_COLS))
  .max(SHEET_MAX_ROWS);

export const sheetColumnSchema = z
  .object({
    label: z.string().trim().max(SHEET_NAME_MAX).optional(),
    width: z.number().int().min(40).max(800).optional(),
  })
  .strict();

export const sheetColumnsSchema = z.array(sheetColumnSchema).max(SHEET_MAX_COLS);

export type SheetCells = z.infer<typeof sheetCellsSchema>;
export type SheetColumn = z.infer<typeof sheetColumnSchema>;

export interface ControlSheet {
  id: string;
  name: string;
  position: number;
  cells: SheetCells;
  columns: SheetColumn[] | null;
  updatedAt: string;
}

/**
 * Dense, trimmed copy of an editor grid: holes become "", trailing empty cells
 * of each row and trailing empty rows are dropped. What the user sees is the
 * same; what is stored is only what was typed.
 */
export function normalizeSheetCells(
  grid: ReadonlyArray<ReadonlyArray<string | null | undefined> | null | undefined>,
): string[][] {
  const rows: string[][] = [];
  for (let r = 0; r < grid.length; r++) {
    const src = grid[r];
    const row: string[] = [];
    if (src) {
      for (let c = 0; c < src.length; c++) row.push(src[c] ?? "");
    }
    while (row.length > 0 && row[row.length - 1] === "") row.pop();
    rows.push(row);
  }
  while (rows.length > 0 && rows[rows.length - 1]!.length === 0) rows.pop();
  return rows;
}

/** UTF-8 size of the JSON the DB will store, to fail early with a clear message. */
export function cellsJsonBytes(cells: SheetCells): number {
  return new TextEncoder().encode(JSON.stringify(cells)).length;
}

/**
 * Reads `cells` coming from the DB. Invalid content (edited by hand, older
 * format) degrades to an empty grid instead of breaking the screen.
 */
export function parseStoredCells(raw: unknown): SheetCells {
  const parsed = sheetCellsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function parseStoredColumns(raw: unknown): SheetColumn[] | null {
  if (raw === null || raw === undefined) return null;
  const parsed = sheetColumnsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Rows x cols to render: at least the default grid, at most the hard limits. */
export function visibleGridSize(cells: SheetCells): { rows: number; cols: number } {
  const widest = cells.reduce((max, row) => Math.max(max, row.length), 0);
  return {
    rows: Math.min(SHEET_MAX_ROWS, Math.max(SHEET_MIN_VISIBLE_ROWS, cells.length)),
    cols: Math.min(SHEET_MAX_COLS, Math.max(SHEET_MIN_VISIBLE_COLS, widest)),
  };
}

/** Returns a new grid with one cell changed; never mutates the input. */
export function setSheetCell(cells: SheetCells, row: number, col: number, value: string): SheetCells {
  const next = cells.map((r) => r.slice());
  while (next.length <= row) next.push([]);
  const target = next[row]!;
  while (target.length <= col) target.push("");
  target[col] = value;
  return next;
}
