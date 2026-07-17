// Exportação da planilha de Controle em CSV, XLSX e PDF.
// Tudo roda no cliente; as libs pesadas (exceljs, jspdf) entram por import dinâmico
// para não engordar o bundle da página — mesmo padrão do QuotePdfModal.

import { type FinancialRecord } from "@/app/actions/control/actions";
import { type ColumnDef, isCustomKey } from "../_components/SpreadsheetGrid";
import {
  computeTotals, computeMonthlyData,
  computeExpenseCategories, computeRevenueCategories,
} from "./aggregate";

const CURRENCY_KEYS = new Set(["revenue", "expense"]);

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const today = () => new Date().toISOString().slice(0, 10);

/** Valor bruto de uma célula, resolvendo colunas custom (custom_fields) e padrão. */
function rawCell(record: FinancialRecord, col: ColumnDef): unknown {
  return isCustomKey(col.key)
    ? (record.custom_fields?.[col.key] ?? "")
    : record[col.key as keyof FinancialRecord];
}

/** Texto de uma célula para CSV/PDF (datas em DD/MM/AAAA, dinheiro formatado). */
function displayCell(record: FinancialRecord, col: ColumnDef): string {
  const val = rawCell(record, col);
  if (CURRENCY_KEYS.has(col.key)) return val ? brl(Number(val)) : "";
  if (col.key === "date" && typeof val === "string" && val.includes("-")) {
    const [y, m, d] = val.split("-");
    return d && m && y ? `${d}/${m}/${y}` : val;
  }
  return val == null ? "" : String(val);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── CSV ────────────────────────────────────────────────────────────────────
export function exportCSV(records: FinancialRecord[], columns: ColumnDef[]) {
  const sep = ";";
  const lines: string[] = [];
  lines.push(columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(sep));

  records.forEach(r => {
    const row = columns.map(col => {
      if (CURRENCY_KEYS.has(col.key)) {
        const v = Number(rawCell(r, col));
        return v ? v.toFixed(2).replace(".", ",") : "";
      }
      const s = displayCell(r, col);
      return `"${s.replace(/"/g, '""')}"`;
    });
    lines.push(row.join(sep));
  });

  // ﻿ (BOM) para o Excel abrir em UTF-8 e não quebrar acento.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `controle_financeiro_${today()}.csv`);
}

// ─── XLSX (2 abas: Dashboard + Lançamentos) ──────────────────────────────────
export async function exportXLSX(records: FinancialRecord[], columns: ColumnDef[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "GLTech3D";
  wb.created = new Date();

  const GREEN = "FF217346";
  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: GREEN } },
    alignment: { vertical: "middle" as const, horizontal: "center" as const },
  };

  // ── Aba 1: Dashboard ──
  const totals = computeTotals(records);
  const monthly = computeMonthlyData(records).filter(m => m.Receita || m.Despesa);
  const expenseCats = computeExpenseCategories(records);
  const revenueCats = computeRevenueCategories(records);

  const dash = wb.addWorksheet("Dashboard", {
    views: [{ showGridLines: false }],
  });
  dash.columns = [{ width: 28 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }];

  dash.mergeCells("A1:E1");
  const title = dash.getCell("A1");
  title.value = "GLTech3D — Controle Financeiro";
  title.font = { bold: true, size: 18, color: { argb: GREEN } };
  dash.getCell("A2").value = `Gerado em ${new Date().toLocaleDateString("pt-BR")}`;
  dash.getCell("A2").font = { italic: true, color: { argb: "FF64748B" } };

  const kpiRow = dash.getRow(4);
  kpiRow.values = ["Receitas Totais", "Despesas Totais", "Saldo Líquido"];
  ["A4", "B4", "C4"].forEach(a => Object.assign(dash.getCell(a), headerStyle));
  const kpiVals = dash.getRow(5);
  kpiVals.getCell(1).value = totals.totalRevenue;
  kpiVals.getCell(2).value = totals.totalExpense;
  kpiVals.getCell(3).value = totals.balance;
  ["A5", "B5", "C5"].forEach(a => {
    const c = dash.getCell(a);
    c.numFmt = 'R$ #,##0.00';
    c.font = { bold: true, size: 13 };
  });

  // Tabela mensal
  let row = 7;
  dash.getCell(`A${row}`).value = "Movimento por mês";
  dash.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;
  const monthHeader = dash.getRow(row);
  ["Mês", "Receita", "Despesa", "Saldo do Mês", "Saldo Acumulado"].forEach((h, i) => {
    const c = monthHeader.getCell(i + 1);
    c.value = h;
    Object.assign(c, headerStyle);
  });
  row++;
  monthly.forEach(m => {
    const r = dash.getRow(row++);
    r.getCell(1).value = m.month;
    r.getCell(2).value = m.Receita;
    r.getCell(3).value = m.Despesa;
    r.getCell(4).value = m["Saldo Mês"];
    r.getCell(5).value = m["Saldo Acumulado"];
    [2, 3, 4, 5].forEach(i => (r.getCell(i).numFmt = 'R$ #,##0.00'));
  });

  // Distribuições por categoria
  row += 1;
  dash.getCell(`A${row}`).value = "Despesas por categoria";
  dash.getCell(`A${row}`).font = { bold: true, size: 12 };
  dash.getCell(`C${row}`).value = "Receitas por categoria";
  dash.getCell(`C${row}`).font = { bold: true, size: 12 };
  row++;
  const catStart = row;
  expenseCats.forEach((c, i) => {
    const r = dash.getRow(catStart + i);
    r.getCell(1).value = c.name;
    r.getCell(2).value = c.value;
    r.getCell(2).numFmt = 'R$ #,##0.00';
  });
  revenueCats.forEach((c, i) => {
    const r = dash.getRow(catStart + i);
    r.getCell(3).value = c.name;
    r.getCell(4).value = c.value;
    r.getCell(4).numFmt = 'R$ #,##0.00';
  });

  // ── Aba 2: Lançamentos ──
  const sheet = wb.addWorksheet("Lançamentos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = columns.map(col => ({
    header: col.label,
    key: col.key,
    width: CURRENCY_KEYS.has(col.key) ? 16 : col.key === "description" ? 34 : 14,
  }));
  const headerRowX = sheet.getRow(1);
  headerRowX.eachCell(c => Object.assign(c, headerStyle));
  headerRowX.height = 20;

  records.forEach(r => {
    const values: Record<string, string | number> = {};
    columns.forEach(col => {
      if (CURRENCY_KEYS.has(col.key)) {
        values[col.key] = Number(rawCell(r, col)) || 0;
      } else if (col.key === "quantity") {
        values[col.key] = Number(rawCell(r, col)) || 0;
      } else {
        values[col.key] = displayCell(r, col);
      }
    });
    const added = sheet.addRow(values);
    columns.forEach((col, i) => {
      if (CURRENCY_KEYS.has(col.key)) added.getCell(i + 1).numFmt = 'R$ #,##0.00';
    });
  });
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `controle_financeiro_${today()}.xlsx`,
  );
}

// ─── PDF (pág. 1 Dashboard, pág. 2 Lançamentos) ──────────────────────────────
export async function exportPDF(records: FinancialRecord[], columns: ColumnDef[]) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210, H = 297, margin = 14;
  const cw = W - margin * 2;

  const INK: [number, number, number] = [15, 23, 42];
  const GREEN: [number, number, number] = [33, 115, 70];
  const RED: [number, number, number] = [185, 28, 28];
  const MUTED: [number, number, number] = [100, 116, 139];
  const LIGHT: [number, number, number] = [241, 245, 249];

  const money = (n: number) =>
    "R$ " + (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Cabeçalho reutilizável ──
  const header = (subtitle: string) => {
    doc.setFillColor(...INK);
    doc.rect(0, 0, W, 30, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("GLTech3D", margin, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(subtitle, margin, 22);
    doc.setFontSize(8);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, W - margin, 14, { align: "right" });
  };

  // ═══ PÁGINA 1 — DASHBOARD ═══
  header("Controle Financeiro — Dashboard");
  const totals = computeTotals(records);
  const monthly = computeMonthlyData(records).filter(m => m.Receita || m.Despesa);
  const expenseCats = computeExpenseCategories(records).slice(0, 8);
  const revenueCats = computeRevenueCategories(records).slice(0, 8);

  let y = 42;

  // KPI cards
  const kpis: [string, number, [number, number, number]][] = [
    ["Receitas Totais", totals.totalRevenue, GREEN],
    ["Despesas Totais", totals.totalExpense, RED],
    ["Saldo Líquido", totals.balance, totals.balance >= 0 ? GREEN : RED],
  ];
  const gap = 4;
  const kw = (cw - gap * 2) / 3;
  kpis.forEach(([label, value, tone], i) => {
    const x = margin + i * (kw + gap);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, kw, 22, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 4, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...tone);
    doc.text(money(value), x + 4, y + 16);
  });
  y += 32;

  // Tabela mensal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Movimento por mês", margin, y);
  y += 4;

  const mCols = [
    { label: "Mês", w: 26, align: "left" as const },
    { label: "Receita", w: (cw - 26) / 4, align: "right" as const },
    { label: "Despesa", w: (cw - 26) / 4, align: "right" as const },
    { label: "Saldo Mês", w: (cw - 26) / 4, align: "right" as const },
    { label: "Acumulado", w: (cw - 26) / 4, align: "right" as const },
  ];
  const drawRow = (cells: string[], opts: { head?: boolean; zebra?: boolean; tones?: ([number, number, number] | null)[] }) => {
    let x = margin;
    if (opts.head) {
      doc.setFillColor(...GREEN);
      doc.rect(margin, y, cw, 8, "F");
    } else if (opts.zebra) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, cw, 7, "F");
    }
    mCols.forEach((c, i) => {
      doc.setFont("helvetica", opts.head ? "bold" : "normal");
      doc.setFontSize(8.5);
      if (opts.head) doc.setTextColor(255, 255, 255);
      else doc.setTextColor(...(opts.tones?.[i] ?? INK));
      const tx = c.align === "right" ? x + c.w - 2 : x + 2;
      doc.text(cells[i] ?? "", tx, y + (opts.head ? 5.5 : 5), { align: c.align });
      x += c.w;
    });
    y += opts.head ? 8 : 7;
  };

  drawRow(mCols.map(c => c.label), { head: true });
  monthly.forEach((m, idx) => {
    drawRow(
      [m.month, money(m.Receita), money(m.Despesa), money(m["Saldo Mês"]), money(m["Saldo Acumulado"])],
      {
        zebra: idx % 2 === 0,
        tones: [INK, GREEN, RED, m["Saldo Mês"] >= 0 ? GREEN : RED, m["Saldo Acumulado"] >= 0 ? GREEN : RED],
      },
    );
  });
  y += 8;

  // Distribuição por categoria (barras horizontais proporcionais)
  const catBlock = (heading: string, items: { name: string; value: number }[], total: number, tone: [number, number, number], x0: number, blockW: number) => {
    let yy = y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(heading, x0, yy);
    yy += 5;
    if (items.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("Sem registros.", x0, yy + 2);
      return;
    }
    items.forEach(it => {
      const pct = total > 0 ? it.value / total : 0;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...INK);
      doc.text(it.name.length > 22 ? it.name.slice(0, 21) + "…" : it.name, x0, yy);
      doc.setTextColor(...MUTED);
      doc.text(money(it.value), x0 + blockW, yy, { align: "right" });
      yy += 2;
      doc.setFillColor(...LIGHT);
      doc.roundedRect(x0, yy, blockW, 2, 1, 1, "F");
      doc.setFillColor(...tone);
      doc.roundedRect(x0, yy, Math.max(blockW * pct, 0.5), 2, 1, 1, "F");
      yy += 6;
    });
  };
  const half = (cw - 8) / 2;
  catBlock("Despesas por categoria", expenseCats, totals.totalExpense, RED, margin, half);
  catBlock("Receitas por categoria", revenueCats, totals.totalRevenue, GREEN, margin + half + 8, half);

  // Rodapé pág. 1
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, H - 14, W - margin, H - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("GLTech3D — Relatório gerado automaticamente. Sem valor fiscal.", margin, H - 9);
  doc.text("Página 1 de 2", W - margin, H - 9, { align: "right" });

  // ═══ PÁGINA 2 — LANÇAMENTOS ═══
  doc.addPage();
  header("Controle Financeiro — Lançamentos");
  y = 40;

  // Larguras proporcionais às colunas configuradas (peso maior p/ descrição).
  const weight = (col: ColumnDef) =>
    col.key === "description" ? 3 : CURRENCY_KEYS.has(col.key) ? 1.6 : col.key === "date" ? 1.4 : 1;
  const totalWeight = columns.reduce((s, c) => s + weight(c), 0);
  const colW = columns.map(c => (weight(c) / totalWeight) * cw);

  const drawLancHeader = () => {
    doc.setFillColor(...GREEN);
    doc.rect(margin, y, cw, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    let x = margin;
    columns.forEach((col, i) => {
      const align = CURRENCY_KEYS.has(col.key) ? "right" : "left";
      const tx = align === "right" ? x + colW[i]! - 2 : x + 2;
      doc.text(col.label.length > 16 ? col.label.slice(0, 15) + "…" : col.label, tx, y + 5.5, { align });
      x += colW[i]!;
    });
    y += 8;
  };
  drawLancHeader();

  records.forEach((r, idx) => {
    if (y > H - 18) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text("Continua…", W - margin, H - 9, { align: "right" });
      doc.addPage();
      header("Controle Financeiro — Lançamentos (cont.)");
      y = 40;
      drawLancHeader();
    }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, cw, 6.5, "F");
    }
    let x = margin;
    columns.forEach((col, i) => {
      const isCur = CURRENCY_KEYS.has(col.key);
      const text = displayCell(r, col);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      if (col.key === "revenue" && Number(rawCell(r, col)) > 0) doc.setTextColor(...GREEN);
      else if (col.key === "expense" && Number(rawCell(r, col)) > 0) doc.setTextColor(...RED);
      else doc.setTextColor(...INK);
      const maxChars = Math.floor(colW[i]! / 1.5);
      const shown = text.length > maxChars ? text.slice(0, Math.max(maxChars - 1, 1)) + "…" : text;
      const align = isCur ? "right" : "left";
      const tx = align === "right" ? x + colW[i]! - 2 : x + 2;
      doc.text(shown, tx, y + 4.5, { align });
      x += colW[i]!;
    });
    y += 6.5;
  });

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, H - 14, W - margin, H - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(`Total de lançamentos: ${records.length}`, margin, H - 9);

  doc.save(`controle_financeiro_${today()}.pdf`);
}
