import type { FinancialRecord } from "@/app/actions/control/actions";

export function exportFinancialRecordsToCSV(records: FinancialRecord[]): string {
  const headers = [
    "Data",
    "Mês",
    "Quantidade",
    "Descrição",
    "Tipo",
    "Categoria",
    "Plataforma",
    "Valor Bruto (R$)",
    "Taxa Plataforma (R$)",
    "Valor Líquido (R$)",
    "Status",
    "Parcelas",
  ];

  const rows = records.map((r) => {
    const isReceita = r.type === "Receita";
    const grossVal = isReceita ? r.revenue || 0 : r.expense || 0;
    const platformFee = r.platform_fee || 0;
    const netVal = r.net_amount ?? (isReceita ? grossVal - platformFee : grossVal);

    return [
      r.date,
      r.month,
      r.quantity,
      `"${(r.description || "").replace(/"/g, '""')}"`,
      r.type,
      `"${(r.category || "").replace(/"/g, '""')}"`,
      `"${(r.platform || "").replace(/"/g, '""')}"`,
      grossVal.toFixed(2),
      platformFee.toFixed(2),
      netVal.toFixed(2),
      r.status || "reconciled",
      r.installments || "1",
    ].join(";");
  });

  // UTF-8 BOM for Microsoft Excel compatibility
  const BOM = "\uFEFF";
  return BOM + [headers.join(";"), ...rows].join("\n");
}
