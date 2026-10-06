/**
 * Guarda de DRIFT entre a migration 0081 e o apêndice do `baseline.sql`.
 *
 * ISTO NÃO É PROVA DE ISOLAMENTO. Ele não conecta em banco nenhum e não observa
 * RLS funcionando — a prova de verdade é `pro-signup-rls.test.ts`, que precisa de
 * `SUPABASE_DB_URL` e por isso não roda em toda máquina.
 *
 * O que este arquivo pega é o modo de falha que acontece de fato: alguém
 * acrescenta uma policy de `anon` à tabela, ou corrige a migration e esquece o
 * baseline. O kit self-host aplica SÓ o baseline — mudança que não chega lá não
 * chega aos clones.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const MIGRATION = path.join(
  ROOT,
  "supabase/migrations/20261003120000_0081_pro_signup_requests.sql",
);
const BASELINE = path.join(ROOT, "supabase/baseline.sql");

const migrationSql = readFileSync(MIGRATION, "utf8").toLowerCase();
const baselineSql = readFileSync(BASELINE, "utf8").toLowerCase();

/** Só o trecho da 0081 dentro do baseline, para não contar policies de outras tabelas. */
const baselineBlock = (() => {
  const marker = "-- ---- pro_signup_requests + bucket pro-receipts (migration 0081) ----";
  const start = baselineSql.indexOf(marker);
  if (start === -1) return "";
  // Cut at the next labelled appendix block: later migrations (e.g. 0083's
  // audit policy `to authenticated`) must not be judged as part of 0081.
  const next = baselineSql.indexOf("\n-- ---- ", start + marker.length);
  return next === -1 ? baselineSql.slice(start) : baselineSql.slice(start, next);
})();

const SOURCES: ReadonlyArray<[string, string]> = [
  ["migration 0081", migrationSql],
  ["apêndice do baseline", baselineBlock],
];

describe("pro_signup_requests — migration e baseline andam juntos", () => {
  it("o baseline contém o bloco rotulado da 0081", () => {
    expect(baselineBlock.length).toBeGreaterThan(0);
  });

  it.each(SOURCES)("%s cria a tabela de forma idempotente", (_label, sql) => {
    expect(sql).toContain("create table if not exists public.pro_signup_requests");
  });

  it.each(SOURCES)("%s habilita RLS na tabela", (_label, sql) => {
    expect(sql).toContain("alter table public.pro_signup_requests enable row level security");
  });

  it.each(SOURCES)("%s cria exatamente uma policy na tabela", (_label, sql) => {
    const matches = sql.match(/create policy \w+ on public\.pro_signup_requests/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it.each(SOURCES)("%s guarda a policy com fn_is_platform_admin()", (_label, sql) => {
    const policyStart = sql.indexOf("create policy");
    const policy = sql.slice(policyStart, policyStart + 400);
    expect(policy).toContain("fn_is_platform_admin()");
    expect(policy).toContain("using");
    expect(policy).toContain("with check");
  });

  it.each(SOURCES)("%s não dá acesso a anon nem a authenticated", (_label, sql) => {
    expect(sql).not.toMatch(/to\s+anon/);
    expect(sql).not.toMatch(/to\s+authenticated/);
    expect(sql).not.toMatch(/grant .* on public\.pro_signup_requests/);
  });

  it.each(SOURCES)("%s deduplica os pendentes ANTES de criar o índice único", (_label, sql) => {
    const dedupeAt = sql.indexOf("set status = 'cancelled'");
    const indexAt = sql.indexOf("pro_signup_requests_one_pending_per_email");
    expect(dedupeAt).toBeGreaterThan(-1);
    expect(indexAt).toBeGreaterThan(-1);
    expect(dedupeAt).toBeLessThan(indexAt);
  });

  it.each(SOURCES)("%s cria o bucket de comprovantes como privado", (_label, sql) => {
    expect(sql).toContain("'pro-receipts'");
    // `public` precisa ser falso na inserção do bucket.
    expect(sql).toMatch(/values \('pro-receipts', 'pro-receipts', false/);
  });

  it.each(SOURCES)("%s limita tipo e tamanho no próprio bucket", (_label, sql) => {
    expect(sql).toContain("file_size_limit");
    expect(sql).toContain("allowed_mime_types");
    expect(sql).toContain("application/pdf");
  });

  it("o MANIFEST registra a 0081", () => {
    const manifest = readFileSync(path.join(ROOT, "supabase/migrations/MANIFEST.md"), "utf8");
    expect(manifest).toContain("0081_pro_signup_requests");
  });
});
