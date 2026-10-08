/**
 * Guarda de DRIFT entre a migration 0082 e o apendice do `baseline.sql`.
 *
 * ISTO NAO E PROVA DE ISOLAMENTO nem de que o schema esta no ar — nao conecta em
 * banco nenhum. O que ele pega e o modo de falha que de fato acontece: alguem
 * corrige a migration e esquece o baseline (e o kit self-host aplica SO o
 * baseline, entao a mudanca nunca chega aos clones), ou alguem acrescenta uma
 * policy de escrita em `organizations` — que e exatamente o que hoje impede um
 * `admin` de tenant de se auto-promover a PRO.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const MIGRATION = path.join(
  ROOT,
  "supabase/migrations/20261003140000_0082_organizations_plan_and_trial.sql",
);
const BASELINE = path.join(ROOT, "supabase/baseline.sql");

const migrationSql = readFileSync(MIGRATION, "utf8").toLowerCase();
const baselineSql = readFileSync(BASELINE, "utf8").toLowerCase();

/** So o trecho da 0082 dentro do baseline, para nao contar blocos de outras migrations. */
const baselineBlock = (() => {
  const marker =
    "-- ---- organizations: plan / trial_ends_at / plan_expires_at (migration 0082) ----";
  const start = baselineSql.indexOf(marker);
  if (start === -1) return "";
  // Cut at the next labelled appendix block: later migrations (e.g. 0087's
  // platform_settings policies) must not be judged as part of 0082.
  const next = baselineSql.indexOf("\n-- ---- ", start + marker.length);
  return next === -1 ? baselineSql.slice(start) : baselineSql.slice(start, next);
})();

const SOURCES: ReadonlyArray<[string, string]> = [
  ["migration 0082", migrationSql],
  ["apendice do baseline", baselineBlock],
];

const COLUMNS = ["plan", "trial_ends_at", "plan_expires_at"] as const;

describe("organizations.plan/trial — migration e baseline andam juntos", () => {
  it("o baseline contem o bloco rotulado da 0082", () => {
    expect(baselineBlock.length).toBeGreaterThan(0);
  });

  it.each(SOURCES)("%s acrescenta as tres colunas de forma idempotente", (_label, sql) => {
    for (const col of COLUMNS) {
      expect(sql).toContain(`add column if not exists ${col}`);
    }
  });

  it.each(SOURCES)("%s cria o CHECK do vocabulario de plano", (_label, sql) => {
    expect(sql).toContain("organizations_plan_check");
    expect(sql).toContain("'standard'");
    expect(sql).toContain("'pro'");
    expect(sql).toContain("'enterprise'");
  });

  it.each(SOURCES)("%s dropa o CHECK antes de recriar (re-aplicavel)", (_label, sql) => {
    const dropAt = sql.indexOf("drop constraint if exists organizations_plan_check");
    const addAt = sql.indexOf("add constraint organizations_plan_check");
    expect(dropAt).toBeGreaterThan(-1);
    expect(addAt).toBeGreaterThan(dropAt);
  });

  it.each(SOURCES)("%s normaliza os dados ANTES de criar o CHECK", (_label, sql) => {
    // Sem isto, o update.sh de um clone com settings->>'plan' fora do
    // vocabulario quebraria ao criar a constraint.
    const normalizeAt = sql.indexOf("set plan = 'standard'");
    const checkAt = sql.indexOf("add constraint organizations_plan_check");
    expect(normalizeAt).toBeGreaterThan(-1);
    expect(checkAt).toBeGreaterThan(-1);
    expect(normalizeAt).toBeLessThan(checkAt);
  });

  it.each(SOURCES)("%s faz o backfill a partir de settings->>'plan'", (_label, sql) => {
    expect(sql).toContain("settings->>'plan'");
  });

  it.each(SOURCES)("%s NAO cria policy nova em organizations", (_label, sql) => {
    // A escrita restrita a platform admin e o que impede auto-promocao de plano.
    expect(sql).not.toMatch(/create policy .* on public\.organizations/);
    expect(sql).not.toMatch(/to\s+anon/);
    expect(sql).not.toMatch(/grant .* on public\.organizations/);
  });

  it.each(SOURCES)("%s NAO cria indice (nenhum leitor varre por plano)", (_label, sql) => {
    expect(sql).not.toMatch(/create index .* on public\.organizations/);
  });

  it("documenta que plan_expires_at NULL com plan=pro e acesso perpetuo", () => {
    // E o que impede a migration de trancar, no deploy, toda org que ja era PRO.
    expect(migrationSql).toContain("sem expiracao");
  });

  it("o MANIFEST registra a 0082", () => {
    const manifest = readFileSync(path.join(ROOT, "supabase/migrations/MANIFEST.md"), "utf8");
    expect(manifest).toContain("0082_organizations_plan_and_trial");
  });
});
