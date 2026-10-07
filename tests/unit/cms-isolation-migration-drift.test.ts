import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

describe("CMS Isolation and Anti-Lockout Migration Drift Test (Migration 0090)", () => {
  it("verifies migration 0090 SQL exists and defines strict RLS with anti-lockout protection", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20261010000000_0090_cms_admin_isolation.sql",
    );

    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf-8");

    // Helper anti-lockout function
    expect(sql).toContain("fn_is_directorate_or_platform_admin");
    expect(sql).toContain("diretoria@gltech3d.com.br");
    expect(sql).toContain("diretoria.gltech@gmail.com");

    // landing_settings RLS policies
    expect(sql).toContain("alter table public.landing_settings enable row level security");
    expect(sql).toContain("landing_settings_select");
    expect(sql).toContain("landing_settings_insert");
    expect(sql).toContain("landing_settings_update");
    expect(sql).toContain("landing_settings_delete");

    // platform_commissions RLS policies
    expect(sql).toContain("alter table public.platform_commissions enable row level security");
    expect(sql).toContain("platform_commissions_select");
    expect(sql).toContain("platform_commissions_write");
  });
});
