/**
 * Leitura do status ao vivo PELO NAVEGADOR (para impressoras na LAN da oficina, que
 * o servidor da Vercel não alcança). O browser do usuário faz `fetch` direto na
 * impressora. Requer CORS habilitado:
 *   - Moonraker: em `moonraker.conf` → [authorization] cors_domains: *  (ou o domínio do CRM)
 *   - OctoPrint: habilitar CORS nas configurações + API key
 *
 * Usa os mesmos parsers puros de `live-status.ts`.
 */
import { parseMoonraker, parseOctoPrint, OFFLINE_STATUS, type LiveStatus } from "./live-status";

async function getJson(url: string, headers?: Record<string, string>, timeoutMs = 4000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, cache: "no-store", mode: "cors" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function pollPrinterFromBrowser(rawUrl: string, apiKey?: string): Promise<LiveStatus> {
  let base: string;
  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return OFFLINE_STATUS;
    base = `${u.origin}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return OFFLINE_STATUS;
  }

  const moon = await getJson(`${base}/printer/objects/query?extruder&heater_bed&print_stats&display_status`);
  if (moon) return parseMoonraker(moon);

  const headers = apiKey ? { "X-Api-Key": apiKey } : undefined;
  const [printer, job] = await Promise.all([
    getJson(`${base}/api/printer`, headers),
    getJson(`${base}/api/job`, headers),
  ]);
  if (printer) return parseOctoPrint(printer, job);

  return OFFLINE_STATUS;
}
