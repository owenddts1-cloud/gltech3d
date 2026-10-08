import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

describe("Financial Realtime DRE Migration Drift Test", () => {
  it("verifies migration 0091 SQL exists and defines accounts_payable, financial columns and view", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261011000000_0091_financial_transactions_cashflow_dre.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf-8");

    // Extensions on financial_records
    expect(sql).toContain("ALTER TABLE public.financial_records");
    expect(sql).toContain("order_id UUID");
    expect(sql).toContain("production_job_id UUID");
    expect(sql).toContain("channel TEXT NOT NULL DEFAULT 'manual'");
    expect(sql).toContain("payment_method TEXT NOT NULL DEFAULT 'pix'");
    expect(sql).toContain("pix_e2e_id TEXT");
    expect(sql).toContain("cpv_filament_cost_cents BIGINT NOT NULL DEFAULT 0");
    expect(sql).toContain("cpv_machine_cost_cents BIGINT NOT NULL DEFAULT 0");
    expect(sql).toContain("is_projected BOOLEAN NOT NULL DEFAULT FALSE");
    expect(sql).toContain("due_date DATE");

    // Accounts payable table
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.accounts_payable");
    expect(sql).toContain("supplier_name TEXT NOT NULL");
    expect(sql).toContain("amount_cents BIGINT NOT NULL");
    expect(sql).toContain("due_date DATE NOT NULL");
    expect(sql).toContain("'pending', 'approved', 'paid', 'cancelled'");

    // RLS policy
    expect(sql).toContain("tenant_isolation_accounts_payable_all");

    // Compatibility view
    expect(sql).toContain("CREATE OR REPLACE VIEW public.financial_transactions");
  });
});
