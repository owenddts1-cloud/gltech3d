/**
 * Irmão do `pro-route-coverage`: o gate de ROTA não basta.
 *
 * O layout `(pro)` só roda na navegação. Uma aba aberta antes de o trial vencer
 * continua chamando server actions — e, até este teste existir, ~15 módulos
 * (projetos, O.S., produtos, estoque, fornecedores...) aceitavam a gravação
 * de quem já estava com o trial vencido.
 *
 * A regra: toda server action exportada que grava (insert/update/upsert/delete,
 * upload, URL de upload assinada) chama `assertProAccess`, diretamente ou pelo
 * helper de contexto do arquivo — ou o arquivo está na allowlist abaixo, com o
 * motivo escrito.
 *
 * É análise estática por regex, não prova formal. Ela pega o caso que importa:
 * a ação nova escrita copiando um arquivo antigo, sem o gate.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

/** Gravações que NÃO são de dado PRO — cada uma com o porquê. */
const ALLOWED: Record<string, string> = {
  "app/actions/auth/confirmMfaEnroll.ts": "segurança da conta; o MFA é exigido justamente do plano pago",
  "app/actions/auth/signOut.ts": "sair nunca pode depender de plano",
  "app/actions/auth/useRecoveryCode.ts": "recuperar acesso nunca pode depender de plano",
  "app/actions/auth/verifyMfa.ts": "login",
  "app/actions/settings/regenerateRecoveryCodes.ts": "segurança da conta",
  "app/actions/settings/trustedDevices.ts": "segurança da conta",
  "app/actions/settings/updateTenant.ts": "Configurações são livres (dados da empresa, inclusive para pagar)",
  "app/actions/settings/updateProfile.ts": "perfil do usuário, livre",
  "app/actions/settings/avatarUpload.ts": "foto do perfil do usuário, livre",
  "app/actions/integrations/disconnectNuvemshop.ts": "desconectar integração deve ser possível mesmo sem plano",
  "app/actions/onboarding/createDefaultAgent.ts": "onboarding da org, antes de qualquer plano",
  "app/actions/onboarding/finishOnboarding.ts": "onboarding da org",
  "app/actions/pro/activateAccount.ts": "ativação de conta recém-paga (token assinado)",
  "app/actions/team/acceptInvite.ts": "aceitar convite (token assinado)",
};

const WRITE = /\.(insert|update|upsert|delete|upload|remove|createSignedUploadUrl)\(/;
const GUARD_HELPERS = /(requireCtx|ensureAdmin|ctx)\(\)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function serverActionFiles(): string[] {
  const actions = walk(path.join(ROOT, "app", "actions"));
  const colocated = walk(path.join(ROOT, "app", "app")).filter((f) => f.endsWith("_actions.ts"));
  return [...actions, ...colocated].filter((f) => readFileSync(f, "utf8").slice(0, 300).includes('"use server"'));
}

/** O helper de contexto do arquivo (requireCtx/ensureAdmin/ctx) já chama o gate? */
function fileHelperIsGated(source: string): boolean {
  const m = source.match(/async function (requireCtx|ensureAdmin|ctx)\b[\s\S]*?\n}\n/);
  return !!m && m[0].includes("assertProAccess");
}

function ungatedWriters(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const helperGated = fileHelperIsGated(source);
  const bad: string[] = [];
  for (const chunk of source.split(/(?=^export async function )/m)) {
    const name = chunk.match(/^export async function (\w+)/)?.[1];
    if (!name || !WRITE.test(chunk)) continue;
    if (chunk.includes("assertProAccess")) continue;
    if (helperGated && GUARD_HELPERS.test(chunk)) continue;
    bad.push(name);
  }
  return bad;
}

describe("gate PRO nas server actions que gravam", () => {
  const files = serverActionFiles();

  it("encontrou server actions para analisar (o glob não quebrou)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("toda ação que grava chama assertProAccess, ou está na allowlist com motivo", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      if (ALLOWED[rel]) continue;
      const bad = ungatedWriters(file);
      if (bad.length) offenders.push(`${rel}: ${bad.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("a allowlist não guarda arquivo que não existe mais", () => {
    const rels = new Set(files.map((f) => path.relative(ROOT, f).split(path.sep).join("/")));
    const stale = Object.keys(ALLOWED).filter((f) => !rels.has(f));
    expect(stale).toEqual([]);
  });
});
