/**
 * Utilitários da jornada do Calc3D PRO (partes A e B).
 *
 * ESTES TESTES ESCREVEM NO BANCO DE PRODUÇÃO — o `.env.local` aponta para ele.
 * Por isso só rodam com `E2E_JOURNEY=1`, e cada rodada usa um e-mail único com
 * `+teste`, que é o único formato que `scripts/limpar-conta-teste.mjs` aceita
 * apagar.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

export const JOURNEY_ENABLED = process.env.E2E_JOURNEY === "1";

const ROOT = path.resolve(__dirname, "../../..");
export const OUT_DIR = path.join(ROOT, "test-results", "jornada");
const STATE_FILE = path.join(ROOT, "test-results", "jornada-estado.json");

/** Lê o .env.local à mão: `dotenv` não é dependência do repo. */
function loadEnv(): Record<string, string> {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const ENV = loadEnv();

/** Service role — só para preparar estado (vencer trial) e conferir o banco. */
export function adminClient(): SupabaseClient {
  const url = ENV.NEXT_PUBLIC_SUPABASE_URL;
  const key = ENV.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface JourneyState {
  email: string;
  password: string;
  displayName: string;
  organizationId: string | null;
  createdAt: string;
}

export function newIdentity(): JourneyState {
  const stamp = Date.now();
  return {
    // Gmail entrega `+alias` na mesma caixa: os e-mails do teste chegam de verdade.
    email: `diretoria.gltech+teste-${stamp}@gmail.com`,
    password: `Teste-${stamp}-ok`,
    displayName: `Oficina Teste ${String(stamp).slice(-5)}`,
    organizationId: null,
    createdAt: new Date().toISOString(),
  };
}

export function saveState(state: JourneyState): void {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function loadState(): JourneyState {
  if (!existsSync(STATE_FILE)) {
    throw new Error("Rode a Parte A primeiro: test-results/jornada-estado.json não existe.");
  }
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as JourneyState;
}

let shot = 0;
/** Print numerado da página inteira. */
export async function snap(page: Page, name: string): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  shot += 1;
  await page.screenshot({
    path: path.join(OUT_DIR, `${String(shot).padStart(2, "0")}-${name}.png`),
    fullPage: true,
  });
}

/** Coleta erros de console e de página durante o teste. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** A tela de erro do Next (500 / boundary) apareceu? */
export async function hasErrorScreen(page: Page): Promise<boolean> {
  const text = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).toLowerCase();
  return (
    text.includes("application error") ||
    text.includes("algo deu errado") ||
    text.includes("unhandled runtime error") ||
    text.includes("internal server error")
  );
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
}

/** Cliente anônimo (anon key) — usado para logar como um SEGUNDO cliente e provar isolamento. */
export function anonClient(): SupabaseClient {
  const url = ENV.NEXT_PUBLIC_SUPABASE_URL;
  const key = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes no .env.local",
    );
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Fecha o guia da tela se ele abriu sozinho (primeira visita). Devolve se havia
 * guia aberto. O guia é um diálogo modal: aberto, ele intercepta os cliques dos
 * passos seguintes.
 */
export async function fecharGuia(page: Page, esperaMs = 2_500): Promise<boolean> {
  const dialogo = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("button", { name: /^Entendi$/ }) });
  const abriu = await dialogo
    .waitFor({ state: "visible", timeout: esperaMs })
    .then(() => true)
    .catch(() => false);
  if (!abriu) return false;
  await dialogo.getByRole("button", { name: /^Entendi$/ }).click();
  await dialogo.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
  return true;
}
