/**
 * Guarda de DRIFT da migration 0087 (products.kind, product_filament_specs,
 * site_orders/site_order_items, platform_settings).
 *
 * NAO conecta em banco — a prova de comportamento (isolamento entre tenants,
 * ficha recusada em produto `peca` ou de outra org, authenticated sem INSERT
 * em site_orders, anon le mas nao altera platform_settings) esta em
 * scripts/verify-baseline.sh, sob RLS de verdade. Aqui pegamos o modo de
 * falha silencioso: a migration muda e o apendice do baseline (que e o que o
 * kit self-host aplica) fica para tras, ou vice-versa.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const MIGRATION = path.join(
  ROOT,
  "supabase/migrations/20261008120000_0087_filament_catalog_site_orders_platform_settings.sql",
);
const BASELINE = path.join(ROOT, "supabase/baseline.sql");
const MANIFEST = path.join(ROOT, "supabase/migrations/MANIFEST.md");

const norm = (s: string) => s.toLowerCase().replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");

const migrationSql = norm(readFileSync(MIGRATION, "utf8"));

/** So o bloco da 0087 dentro do baseline (ate o proximo bloco rotulado). */
const baselineBlock = (() => {
  const all = norm(readFileSync(BASELINE, "utf8"));
  const marker = "(migration 0087) ----";
  const start = all.indexOf(marker);
  if (start === -1) return "";
  const next = all.indexOf("\n-- ---- ", start + marker.length);
  return next === -1 ? all.slice(start) : all.slice(start, next);
})();

const SOURCES: ReadonlyArray<[string, string]> = [
  ["migration 0087", migrationSql],
  ["apendice do baseline", baselineBlock],
];

describe("0087 — catalogo de filamentos, pedidos do site e platform_settings", () => {
  it("o baseline contem o bloco rotulado da 0087", () => {
    expect(baselineBlock.length).toBeGreaterThan(0);
  });

  it("o MANIFEST registra a 0087", () => {
    expect(readFileSync(MANIFEST, "utf8")).toContain(
      "`0087_filament_catalog_site_orders_platform_settings`",
    );
  });

  it.each(SOURCES)("%s cria products.kind com default peca e CHECK peca/filamento", (_l, sql) => {
    expect(sql).toContain("add column if not exists kind text not null default 'peca'");
    expect(sql).toContain("add constraint products_kind_check check (kind in ('peca', 'filamento'))");
    expect(sql).toMatch(
      /create index if not exists products_org_kind_published_idx\s+on public\.products \(organization_id, kind, is_published, sort_order\)/,
    );
  });

  it.each(SOURCES)("%s cria product_filament_specs 1:1 com guarda de org e kind", (_l, sql) => {
    expect(sql).toContain("create table if not exists public.product_filament_specs");
    expect(sql).toMatch(/product_id uuid primary key references public\.products\(id\) on delete cascade/);
    expect(sql).toMatch(/material_id uuid references public\.materials\(id\) on delete set null/);
    expect(sql).toContain("check (color_hex ~ '^#[0-9a-fa-f]{6}$')");
    expect(sql).toContain("check (diameter_mm in (1.75, 2.85))");
    expect(sql).toContain(
      "check (availability in ('em_estoque', 'ultimas_unidades', 'sob_encomenda', 'esgotado'))",
    );
    expect(sql).toContain("check (tds_url ~ '^https://')");
    expect(sql).toContain("create or replace function public.fn_product_filament_specs_guard()");
    expect(sql).toContain("using errcode = 'check_violation'");
    expect(sql).toMatch(/v_kind is distinct from 'filamento'/);
    // DELETE so manager+ ou platform admin
    expect(sql).toMatch(
      /create policy tenant_isolation_product_filament_specs_delete on public\.product_filament_specs\s+for delete using \(public\.fn_role_at_least\(organization_id, 'manager'\) or public\.fn_is_platform_admin\(\)\)/,
    );
    expect(sql).toContain("revoke all on public.product_filament_specs from anon;");
  });

  it.each(SOURCES)("%s cria site_orders/site_order_items sem INSERT para usuario", (_l, sql) => {
    expect(sql).toContain("create table if not exists public.site_orders");
    expect(sql).toContain("create table if not exists public.site_order_items");
    expect(sql).toContain("check (customer_whatsapp ~ '^[0-9]{10,13}$')");
    expect(sql).toContain("check (status in ('novo', 'confirmado', 'cancelado'))");
    expect(sql).toContain("check (source in ('site_filamentos', 'site_produtos'))");
    expect(sql).toContain("check (qty between 1 and 999)");
    expect(sql).toContain("create or replace function public.fn_site_order_items_guard()");
    expect(sql).toMatch(
      /create policy tenant_isolation_site_orders_update on public\.site_orders\s+for update using \(public\.fn_role_at_least\(organization_id, 'agent'\)/,
    );
    expect(sql).toMatch(
      /create policy tenant_isolation_site_orders_delete on public\.site_orders\s+for delete using \(public\.fn_role_at_least\(organization_id, 'manager'\)/,
    );
    // nenhuma policy de INSERT/ALL nos pedidos do site, e sem GRANT de insert
    expect(sql).not.toMatch(/create policy \S+ on public\.site_order(s|_items)\s+for (insert|all)/);
    expect(sql).toContain("grant select, delete on public.site_orders to authenticated;");
    expect(sql).toContain("grant select, delete on public.site_order_items to authenticated;");
    expect(sql).toContain("revoke all on public.site_orders from anon, authenticated;");
  });

  it.each(SOURCES)("%s cria platform_settings de linha unica, leitura publica e escrita de platform admin", (_l, sql) => {
    expect(sql).toContain("create table if not exists public.platform_settings");
    expect(sql).toContain("check (id = 1)");
    expect(sql).toContain("insert into public.platform_settings (id) values (1) on conflict (id) do nothing;");
    expect(sql).toContain("check (jsonb_typeof(pro_benefits) = 'array')");
    expect(sql).toContain("check (jsonb_typeof(calculator_defaults) = 'object')");
    expect(sql).toMatch(
      /create policy platform_settings_select on public\.platform_settings\s+for select to anon, authenticated using \(true\)/,
    );
    // Escrita SO pela rota admin (service role, depois do MFA): fn_is_platform_admin()
    // ignora o AAL, entao policy/grant de escrita reabriria edicao de preco sem MFA.
    for (const cmd of ["insert", "update", "delete"]) {
      expect(sql, cmd).toContain(`drop policy if exists platform_settings_${cmd} on public.platform_settings;`);
      expect(sql, cmd).not.toMatch(new RegExp(`create policy platform_settings_${cmd}\\b`));
    }
    expect(sql).toContain("revoke all on public.platform_settings from anon, authenticated;");
    expect(sql).toContain("grant select on public.platform_settings to anon, authenticated;");
    expect(sql).not.toMatch(/grant [^;]*(insert|update|delete)[^;]* on public\.platform_settings to [^;]*(anon|authenticated)/);
  });

  it.each(SOURCES)("%s torna products.kind imutavel", (_l, sql) => {
    expect(sql).toContain("create or replace function public.fn_products_kind_immutable()");
    expect(sql).toContain("if new.kind is distinct from old.kind then");
    expect(sql).toMatch(
      /create trigger trg_products_kind_immutable\s+before update of kind on public\.products/,
    );
  });

  it.each(SOURCES)("%s restringe o UPDATE de site_orders a status/notes, com gatilho de defesa", (_l, sql) => {
    expect(sql).toContain("grant update (status, notes) on public.site_orders to authenticated;");
    expect(sql).not.toMatch(/grant [^;(]*\bupdate\b[^;(]* on public\.site_orders to authenticated/);
    expect(sql).toContain("create or replace function public.fn_site_orders_guard_update()");
    expect(sql).toContain("if v_role is null or v_role = 'service_role' then");
    expect(sql).toContain("if old.converted_at is not null and new.converted_at is null then");
    for (const col of ["converted_at", "total_cents", "customer_name", "customer_whatsapp", "organization_id", "source"]) {
      expect(sql, col).toContain(`new.${col} is distinct from old.${col}`);
    }
    expect(sql).toMatch(/create trigger trg_site_orders_guard_update\s+before update on public\.site_orders/);
  });

  it("o apendice do baseline e o corpo da migration sao identicos (fora o cabecalho)", () => {
    const body = migrationSql.slice(migrationSql.indexOf("-- 1. products.kind"));
    expect(body.length).toBeGreaterThan(0);
    expect(baselineBlock).toContain(body.trimEnd());
  });
});
