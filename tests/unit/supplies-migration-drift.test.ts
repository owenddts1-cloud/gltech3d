import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Migration 0088: supplies and procurement schema", () => {
  const filePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261007160000_0088_supplies_and_procurement.sql"
  );

  it("file exists and contains financial_record_id foreign key on supplier_purchases", () => {
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("supplier_purchases");
    expect(content).toContain("financial_record_id UUID REFERENCES public.financial_records(id)");
  });
});
