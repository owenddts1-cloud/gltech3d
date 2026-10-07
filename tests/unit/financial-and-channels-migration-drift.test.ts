import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Migration 0087: financial_records and sales_channel_integrations schema", () => {
  const filePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261007150000_0087_financial_and_sales_channels.sql"
  );

  it("file exists and is readable", () => {
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf8");
    expect(content.length).toBeGreaterThan(100);
  });

  it("contains necessary schema additions for financial_records", () => {
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("financial_records");
    expect(content).toContain("status TEXT NOT NULL DEFAULT 'reconciled'");
    expect(content).toContain("net_cents BIGINT NOT NULL DEFAULT 0");
    expect(content).toContain("platform_fee_cents BIGINT NOT NULL DEFAULT 0");
    expect(content).toContain("reconciled_at TIMESTAMPTZ");
  });

  it("contains sales_channel_integrations table creation and RLS policies", () => {
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("CREATE TABLE IF NOT EXISTS public.sales_channel_integrations");
    expect(content).toContain("platform IN ('Shopee', 'Mercado Livre', 'Facebook')");
    expect(content).toContain("ENABLE ROW LEVEL SECURITY");
    expect(content).toContain("sales_channel_integrations_select");
    expect(content).toContain("fn_user_org_ids");
    expect(content).toContain("fn_role_at_least");
    expect(content).toContain("fn_is_platform_admin");
  });

});
