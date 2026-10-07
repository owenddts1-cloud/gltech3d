import { describe, it, expect } from "vitest";
import { exportFinancialRecordsToCSV } from "./csv-export";
import type { FinancialRecord } from "@/app/actions/control/actions";

describe("exportFinancialRecordsToCSV", () => {
  it("includes UTF-8 BOM, headers, semicolon delimiters, and formatted financial data", () => {
    const records: FinancialRecord[] = [
      {
        id: "1",
        date: "2026-10-05",
        month: "OUT.",
        quantity: 1,
        description: 'Venda de "Peça Especial"',
        type: "Receita",
        category: "Vendas",
        revenue: 150.0,
        expense: 0,
        platform_fee: 15.0,
        status: "reconciled",
        installments: "1",
        platform: "Shopee",
      },
    ];

    const csv = exportFinancialRecordsToCSV(records);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Data;Mês;Quantidade;Descrição;Tipo;Categoria;Plataforma;Valor Bruto (R$);Taxa Plataforma (R$);Valor Líquido (R$);Status;Parcelas");
    expect(csv).toContain("2026-10-05;OUT.;1;\"Venda de \"\"Peça Especial\"\"\";Receita;\"Vendas\";\"Shopee\";150.00;15.00;135.00;reconciled;1");
  });
});
