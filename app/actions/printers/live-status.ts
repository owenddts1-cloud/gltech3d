"use server";

import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import {
  parseMoonraker, parseOctoPrint, OFFLINE_STATUS, type LiveStatus,
} from "@/lib/printers/live-status";

/**
 * Lê o status ao vivo de uma impressora por IP, no SERVIDOR (caminho para impressora
 * com IP público / túnel — Vercel não alcança LAN 192.168.x; nesse caso use o modo
 * "navegador" no cliente). Tenta Moonraker e cai para OctoPrint.
 *
 * SSRF: aceita só http/https e bloqueia endpoints de metadata de nuvem. É org-scoped
 * (exige usuário autenticado); ainda assim, mantenha as impressoras atrás de auth/túnel.
 */

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    // Bloqueia metadata de nuvem (AWS/GCP/Azure) — vetor SSRF clássico.
    if (host === "169.254.169.254" || host === "metadata.google.internal" || host === "metadata") return null;
    return u;
  } catch {
    return null;
  }
}

async function getJson(url: string, headers?: Record<string, string>, timeoutMs = 4000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchPrinterLiveStatus(
  input: { url: string; apiKey?: string },
): Promise<{ ok: false; error: string } | { ok: true; status: LiveStatus }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };

  const u = safeUrl(input.url);
  if (!u) return { ok: false, error: "URL inválida" };
  const base = `${u.origin}${u.pathname.replace(/\/$/, "")}`;

  // 1) Moonraker (Klipper) — sem auth por padrão.
  const moon = await getJson(`${base}/printer/objects/query?extruder&heater_bed&print_stats&display_status`);
  if (moon) return { ok: true, status: parseMoonraker(moon) };

  // 2) OctoPrint — precisa de X-Api-Key.
  const headers = input.apiKey ? { "X-Api-Key": input.apiKey } : undefined;
  const [printer, job] = await Promise.all([
    getJson(`${base}/api/printer`, headers),
    getJson(`${base}/api/job`, headers),
  ]);
  if (printer) return { ok: true, status: parseOctoPrint(printer, job) };

  // Inalcançável (offline, CORS, firewall, ou LAN não visível pelo servidor).
  return { ok: true, status: OFFLINE_STATUS };
}
