import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

describe("AI Farm System Migration Drift Test", () => {
  it("verifies migration 0089 SQL exists and defines core tables", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261009000000_0089_ai_agents_farm_system.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.machines");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.spools_inventory");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.ai_orders");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.ai_order_items");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.ai_production_jobs");
    expect(sql).toContain("check_spool_mass_non_negative");
    expect(sql).toContain("tenant_isolation_machines_all");
  });
});
