/**
 * Carga de `.env.local` / `.env` para scripts avulsos (`npx tsx scripts/...`).
 *
 * Scripts não passam pelo Next, então não herdam o carregamento de env dele e
 * também não podem importar `lib/env.ts` — aquele módulo valida o conjunto
 * INTEIRO com Zod e lança se faltar qualquer variável de runtime da aplicação,
 * o que quebraria um script que só precisa de duas.
 *
 * Variável já presente no ambiente vence o arquivo (permite
 * `SUPABASE_SERVICE_ROLE_KEY=... npx tsx ...` sem editar arquivo nenhum).
 */

import { readFileSync } from "node:fs";

export function loadEnvFiles(): void {
  for (const file of [".env.local", ".env"]) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue; // ausência é esperada conforme o ambiente
    }
    for (const line of content.split("\n")) {
      const match = line.match(/^([A-Z_0-9]+)\s*=\s*(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

/**
 * Credenciais de service role + org alvo. Centralizado porque todo script de
 * dados precisa exatamente disto, e errar a mensagem de erro custa tempo.
 */
export function requireServiceRoleEnv(): {
  url: string;
  serviceKey: string;
  orgSlug: string;
} {
  loadEnvFiles();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (procurei em .env.local e .env).",
    );
  }
  return { url, serviceKey, orgSlug: process.env.LANDING_ORG_SLUG ?? "gltech3d" };
}
