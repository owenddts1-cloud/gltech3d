import "@testing-library/jest-dom/vitest";

/**
 * Env mínima para os testes.
 *
 * `lib/env.ts` valida tudo no import e lança se faltar variável crítica — o que
 * é o comportamento certo em produção, mas impedia testar qualquer módulo que
 * importasse `env`. Os valores abaixo são placeholders sem significado: só
 * satisfazem o schema para o import não explodir.
 *
 * `setupFiles` roda antes dos arquivos de teste, então isto está definido antes
 * de qualquer módulo ser carregado. Só preenche o que ainda não existe, para não
 * atropelar um `.env` de quem roda os testes localmente.
 */
const TEST_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  INTERNAL_SECRET: "test-internal-secret",
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  if (!process.env[key]) process.env[key] = value;
}
