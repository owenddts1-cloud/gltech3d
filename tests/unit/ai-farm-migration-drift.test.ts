import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

describe("AI Farm System Migration Drift Test", () => {
  it("verifies migration 0089 SQL exists and defines core tables, aliases and mass constraints", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261009000000_0089_ai_agents_farm_system.sql"
    );

    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf-8");

    // Core tables
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.machines");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.spools_inventory");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.ai_orders");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.ai_order_items");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.ai_production_jobs");

    // Printer dimensions, technology and lifecycle status
    expect(sql).toContain("technology TEXT NOT NULL DEFAULT 'FDM'");
    expect(sql).toContain("bed_size_x_mm NUMERIC(8, 2)");
    expect(sql).toContain("bed_size_y_mm NUMERIC(8, 2)");
    expect(sql).toContain("bed_size_z_mm NUMERIC(8, 2)");
    expect(sql).toContain("'idle', 'preheating', 'printing', 'paused', 'maintenance', 'error', 'offline'");
    expect(sql).toContain("loaded_spool_id UUID");

    // Spool mass attributes and safety tolerance
    expect(sql).toContain("nominal_density_g_cm3 NUMERIC(5, 3)");
    expect(sql).toContain("gross_weight_g NUMERIC(10, 2)");
    expect(sql).toContain("remaining_weight_g NUMERIC(10, 2)");
    expect(sql).toContain("reserved_weight_g NUMERIC(10, 2)");
    expect(sql).toContain("safety_tolerance_pct NUMERIC(5, 2)");
    expect(sql).toContain("check_spool_mass_non_negative");

    // Production queue priority and lifecycle
    expect(sql).toContain("priority_level TEXT NOT NULL DEFAULT 'normal'");
    expect(sql).toContain("'queued', 'preheating', 'printing', 'completed', 'failed', 'aborted'");

    // Compatibility views
    expect(sql).toContain("CREATE OR REPLACE VIEW public.printers");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.filament_inventory");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.production_queue");

    // RLS policy
    expect(sql).toContain("tenant_isolation_machines_all");
    expect(sql).toContain("tenant_isolation_spools_all");
  });
});
