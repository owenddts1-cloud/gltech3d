// Exportação dos Relatórios em CSV, XLSX e PDF (imagens 7 e 10 do Manequip).
// Mesmo padrão da Fase 1 do Controle: libs pesadas por import dinâmico.

export interface ReportsExportPayload {
  periodLabel: string;
  kpis: { label: string; value: string }[];
  monthly: { month: string; revenueCents: number; filamentGrams: number; activeHours: number; jobs: number }[];
  breakdowns: { title: string; isCurrency: boolean; groups: { name: string; value: number }[] }[];
}

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
const today = () => new Date().toISOString().slice(0, 10);
const GREEN = "FF217346";

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

// ─── CSV ─────────────────────────────────────────────────────────────────────
export function exportReportsCSV(p: ReportsExportPayload) {
  const sep = ";";
  const lines: string[] = [];
  lines.push(`Relatório GLTech3D — ${p.periodLabel}`);
  lines.push("");
  lines.push("Mês;Faturamento (R$);Filamento (g);Horas ativas;Jobs");
  p.monthly.forEach((m) => {
    lines.push([m.month, (m.revenueCents / 100).toFixed(2).replace(".", ","), m.filamentGrams, m.activeHours, m.jobs].join(sep));
  });
  p.breakdowns.forEach((b) => {
    lines.push("");
    lines.push(b.title);
    b.groups.forEach((g) => lines.push([`"${g.name.replace(/"/g, '""')}"`, b.isCurrency ? (g.value / 100).toFixed(2).replace(".", ",") : g.value].join(sep)));
  });
  triggerDownload(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }), `relatorio-gltech3d-${today()}.csv`);
}

// ─── XLSX (Resumo + Mensal + 1 aba por breakdown) ────────────────────────────
export async function exportReportsXLSX(p: ReportsExportPayload) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "GLTech3D";
  wb.created = new Date();

  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: GREEN } },
    alignment: { vertical: "middle" as const, horizontal: "center" as const },
  };

  // Resumo
  const resume = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  resume.columns = [{ width: 32 }, { width: 22 }];
  resume.mergeCells("A1:B1");
  resume.getCell("A1").value = `Relatório GLTech3D — ${p.periodLabel}`;
  resume.getCell("A1").font = { bold: true, size: 16, color: { argb: GREEN } };
  let row = 3;
  p.kpis.forEach((k) => {
    resume.getCell(`A${row}`).value = k.label;
    resume.getCell(`A${row}`).font = { bold: true };
    resume.getCell(`B${row}`).value = k.value;
    row++;
  });

  // Mensal
  const monthly = wb.addWorksheet("Mensal", { views: [{ state: "frozen", ySplit: 1 }] });
  monthly.columns = [
    { header: "Mês", key: "month", width: 12 },
    { header: "Faturamento (R$)", key: "rev", width: 18 },
    { header: "Filamento (g)", key: "fil", width: 15 },
    { header: "Horas ativas", key: "hrs", width: 14 },
    { header: "Jobs", key: "jobs", width: 10 },
  ];
  monthly.getRow(1).eachCell((c) => Object.assign(c, headerStyle));
  p.monthly.forEach((m) => {
    const r = monthly.addRow({ month: m.month, rev: m.revenueCents / 100, fil: m.filamentGrams, hrs: m.activeHours, jobs: m.jobs });
    r.getCell(2).numFmt = 'R$ #,##0.00';
  });

  // Uma aba por breakdown
  p.breakdowns.forEach((b) => {
    const safe = b.title.replace(/[\\/*?:[\]]/g, "").slice(0, 28);
    const ws = wb.addWorksheet(safe || "Breakdown", { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [
      { header: b.title, key: "name", width: 34 },
      { header: b.isCurrency ? "Valor (R$)" : "Qtde", key: "val", width: 18 },
    ];
    ws.getRow(1).eachCell((c) => Object.assign(c, headerStyle));
    b.groups.forEach((g) => {
      const r = ws.addRow({ name: g.name, val: b.isCurrency ? g.value / 100 : g.value });
      if (b.isCurrency) r.getCell(2).numFmt = 'R$ #,##0.00';
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `relatorio-gltech3d-${today()}.xlsx`);
}

// ─── PDF (pág. 1 resumo+mensal, pág. 2 breakdowns) ───────────────────────────
export async function exportReportsPDF(p: ReportsExportPayload) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210, H = 297, margin = 14, cw = W - margin * 2;
  const INK: [number, number, number] = [15, 23, 42];
  const GREENc: [number, number, number] = [33, 115, 70];
  const MUTED: [number, number, number] = [100, 116, 139];
  const LIGHT: [number, number, number] = [241, 245, 249];

  const header = (subtitle: string) => {
    doc.setFillColor(...INK);
    doc.rect(0, 0, W, 30, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(255, 255, 255);
    doc.text("GLTech3D", margin, 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(148, 163, 184);
    doc.text(subtitle, margin, 22);
    doc.setFontSize(8);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, W - margin, 14, { align: "right" });
  };

  // ── Página 1 ──
  header(`Relatório Analítico — ${p.periodLabel}`);
  let y = 42;

  // KPIs
  const kw = (cw - 8) / 2;
  p.kpis.slice(0, 4).forEach((k, i) => {
    const x = margin + (i % 2) * (kw + 8);
    if (i % 2 === 0 && i > 0) y += 22;
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, kw, 18, 2, 2, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(k.label.toUpperCase(), x + 4, y + 6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...INK);
    doc.text(k.value, x + 4, y + 14);
  });
  y += 30;

  // Tabela mensal
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
  doc.text("Evolução mensal", margin, y); y += 4;
  const cols = [
    { label: "Mês", w: 30, align: "left" as const },
    { label: "Faturamento", w: (cw - 30) / 4, align: "right" as const },
    { label: "Filamento (g)", w: (cw - 30) / 4, align: "right" as const },
    { label: "Horas", w: (cw - 30) / 4, align: "right" as const },
    { label: "Jobs", w: (cw - 30) / 4, align: "right" as const },
  ];
  const rowVals = (cells: string[], head = false, zebra = false) => {
    if (head) { doc.setFillColor(...GREENc); doc.rect(margin, y, cw, 8, "F"); }
    else if (zebra) { doc.setFillColor(248, 250, 252); doc.rect(margin, y, cw, 7, "F"); }
    let x = margin;
    cols.forEach((c, i) => {
      doc.setFont("helvetica", head ? "bold" : "normal"); doc.setFontSize(8.5);
      doc.setTextColor(...(head ? [255, 255, 255] as [number, number, number] : INK));
      doc.text(cells[i] ?? "", c.align === "right" ? x + c.w - 2 : x + 2, y + (head ? 5.5 : 5), { align: c.align });
      x += c.w;
    });
    y += head ? 8 : 7;
  };
  rowVals(cols.map((c) => c.label), true);
  p.monthly.forEach((m, i) => rowVals([m.month, brl(m.revenueCents), String(m.filamentGrams), `${m.activeHours}h`, String(m.jobs)], false, i % 2 === 0));

  doc.setDrawColor(226, 232, 240); doc.line(margin, H - 14, W - margin, H - 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text("GLTech3D — Relatório gerado automaticamente. Sem valor fiscal.", margin, H - 9);
  doc.text("Página 1 de 2", W - margin, H - 9, { align: "right" });

  // ── Página 2 — breakdowns ──
  doc.addPage();
  header("Detalhamento por grupo");
  y = 40;
  p.breakdowns.forEach((b) => {
    if (y > H - 40) { doc.addPage(); header("Detalhamento por grupo (cont.)"); y = 40; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
    doc.text(b.title, margin, y); y += 5;
    const total = b.groups.reduce((s, g) => s + g.value, 0);
    b.groups.slice(0, 12).forEach((g) => {
      if (y > H - 16) { doc.addPage(); header("Detalhamento por grupo (cont.)"); y = 40; }
      const pct = total > 0 ? g.value / total : 0;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...INK);
      doc.text(g.name.length > 34 ? g.name.slice(0, 33) + "…" : g.name, margin, y);
      doc.setTextColor(...MUTED);
      doc.text(b.isCurrency ? brl(g.value) : String(g.value), W - margin, y, { align: "right" });
      y += 2;
      doc.setFillColor(...LIGHT); doc.roundedRect(margin, y, cw, 1.6, 0.8, 0.8, "F");
      doc.setFillColor(...GREENc); doc.roundedRect(margin, y, Math.max(cw * pct, 0.5), 1.6, 0.8, 0.8, "F");
      y += 6;
    });
    y += 4;
  });
  doc.setDrawColor(226, 232, 240); doc.line(margin, H - 14, W - margin, H - 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text("Página 2 de 2", W - margin, H - 9, { align: "right" });

  doc.save(`relatorio-gltech3d-${today()}.pdf`);
}
