/**
 * Guarda de DRIFT da migration 0084 (DELETE por papel + org suspensa).
 *
 * NAO conecta em banco — a prova de comportamento (agent nao apaga contato,
 * manager apaga produto, so admin apaga lancamento, org suspensa some de
 * fn_user_org_ids) esta em scripts/verify-baseline.sh, sob RLS de verdade.
 * Aqui pegamos o modo de falha silencioso: alguem muda o papel de uma tabela
 * na migration e esquece o apendice do baseline (o kit self-host aplica SO o
 * baseline), ou muda o mapa de lib/auth/delete-policy.ts — que gera as
 * mensagens de "nada foi excluido" — sem mudar o banco.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TABLE_DELETE_MIN_ROLE } from "@/lib/auth/delete-policy";

const ROOT = path.resolve(__dirname, "../..");
const MIGRATION = path.join(
  ROOT,
  "supabase/migrations/20261007120000_0084_role_delete_policies_and_suspended_orgs.sql",
);
const BASELINE = path.join(ROOT, "supabase/baseline.sql");

const norm = (s: string) => s.toLowerCase().replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");

const migrationSql = norm(readFileSync(MIGRATION, "utf8"));

/** So o bloco da 0084 dentro do baseline (ate o proximo bloco rotulado). */
const baselineBlock = (() => {
  const all = norm(readFileSync(BASELINE, "utf8"));
  const marker = "(migration 0084) ----";
  const start = all.indexOf(marker);
  if (start === -1) return "";
  const next = all.indexOf("\n-- ---- ", start + marker.length);
  return next === -1 ? all.slice(start) : all.slice(start, next);
})();

const SOURCES: ReadonlyArray<[string, string]> = [
  ["migration 0084", migrationSql],
  ["apendice do baseline", baselineBlock],
];

/** Prefixo de nome de policy de cada tabela — segue o nome da policy *_all original. */
function policyPrefix(table: string): string {
  return table === "conversations" || table === "messages"
    ? `${table}_tenant_isolation`
    : `tenant_isolation_${table}`;
}

const TABLES = Object.entries(TABLE_DELETE_MIN_ROLE);

describe("0084 — DELETE por papel: migration, baseline e mapa TS andam juntos", () => {
  it("o baseline contem o bloco rotulado da 0084", () => {
    expect(baselineBlock.length).toBeGreaterThan(0);
  });

  it("o mapa cobre as 18 tabelas de negocio", () => {
    expect(TABLES).toHaveLength(18);
  });

  it("contacts e financial_records sao admin; filaments/printers/itens de O.S. sao de membro", () => {
    expect(TABLE_DELETE_MIN_ROLE.contacts).toBe("admin");
    expect(TABLE_DELETE_MIN_ROLE.financial_records).toBe("admin");
    // replace-all no salvar: apagar e parte da edicao comum
    expect(TABLE_DELETE_MIN_ROLE.filaments).toBe("member");
    expect(TABLE_DELETE_MIN_ROLE.printers).toBe("member");
    expect(TABLE_DELETE_MIN_ROLE.service_order_items).toBe("member");
  });

  it.each(SOURCES)("%s declara cada tabela com o papel do mapa TS", (_label, sql) => {
    for (const [table, role] of TABLES) {
      const tuple = new RegExp(`\\('${table}', *'${policyPrefix(table)}', *'${role}', *(true|false)\\)`);
      expect(sql, `${table} -> ${role}`).toMatch(tuple);
    }
  });

  it.each(SOURCES)("%s derruba a policy *_all e cria as quatro por comando", (_label, sql) => {
    expect(sql).toContain("r.prefix || '_all'");
    for (const cmd of ["select", "insert", "update", "delete"]) {
      expect(sql).toContain(`r.prefix || '_${cmd}'`);
      expect(sql).toContain(`for ${cmd}`);
    }
    // re-aplicavel: drop-if-exists antes de cada create
    expect(sql.match(/drop policy if exists %i on public\.%i/g)?.length).toBe(5);
  });

  it.each(SOURCES)("%s usa fn_role_at_least no DELETE e mantem WITH CHECK em insert/update", (_label, sql) => {
    expect(sql).toContain("public.fn_role_at_least(organization_id, %l) or public.fn_is_platform_admin()");
    expect(sql).toContain("for insert with check %s");
    expect(sql).toContain("for update using %s with check %s");
  });

  it.each(SOURCES)("%s filtra org ativa em fn_user_org_ids e fn_user_role_in_org", (_label, sql) => {
    const orgIds = sql.slice(sql.indexOf("function public.fn_user_org_ids()"));
    expect(orgIds.slice(0, 600)).toContain("o.status = 'active'");
    const role = sql.slice(sql.indexOf("function public.fn_user_role_in_org(p_org uuid)"));
    expect(role.slice(0, 600)).toContain("o.status = 'active'");
    // continuam SECURITY DEFINER com search_path fixo
    expect(orgIds.slice(0, 300)).toContain("security definer");
    expect(orgIds.slice(0, 300)).toContain("set search_path to 'public'");
  });
});
