/**
 * Conserta caminhos de mídia `/public` quebrados em `products.images` /
 * `products.videos`.
 *
 * POR QUE UM SCRIPT E NÃO UMA MIGRATION: o SQL não enxerga o disco. Saber que
 * "/images/Pota Celular/..." está errado exige testar o arquivo em `public/`.
 * Além disso o dado é conteúdo de um tenant, e a doutrina do repo proíbe
 * hardcode de tenant em migration.
 *
 * REGRA ANTI-CHUTE: só corrige quando o basename tem EXATAMENTE UMA ocorrência
 * em `public/`. Zero ocorrências (arquivo não existe) ou duas ou mais (ambíguo)
 * são reportadas e deixadas como estão. O script não adivinha.
 *
 * Uso:
 *   npx tsx scripts/fix-local-media-paths.ts --dry-run   # só mostra
 *   npx tsx scripts/fix-local-media-paths.ts             # aplica
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, basename, posix } from "node:path";

import { requireServiceRoleEnv } from "./_env";

const PUBLIC_DIR = "public";

/** Índice basename → caminhos web ("/images/...") de tudo que existe em public/. */
function indexPublicFiles(): Map<string, string[]> {
  const index = new Map<string, string[]>();

  function walk(absDir: string, webDir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(absDir);
    } catch {
      return; // pasta ausente é esperada em clone sem mídia
    }
    for (const entry of entries) {
      const abs = join(absDir, entry);
      if (statSync(abs).isDirectory()) {
        walk(abs, posix.join(webDir, entry));
        continue;
      }
      const list = index.get(entry) ?? [];
      list.push(posix.join(webDir, entry));
      index.set(entry, list);
    }
  }

  for (const root of ["images", "videos"]) {
    walk(join(PUBLIC_DIR, root), `/${root}`);
  }
  return index;
}

type Verdict =
  | { kind: "ok" }
  | { kind: "fixed"; to: string }
  | { kind: "missing" }
  | { kind: "ambiguous"; candidates: string[] };

/**
 * `decodeURI` porque o banco pode guardar o caminho percent-encoded (o browser
 * codifica o espaço de "Porta Celular"), mas no disco o espaço é um espaço.
 */
function judge(entry: string, index: Map<string, string[]>): Verdict {
  if (!entry.startsWith("/") || entry.startsWith("//")) return { kind: "ok" }; // URL externa: não é nosso
  let decoded: string;
  try {
    decoded = decodeURI(entry);
  } catch {
    decoded = entry; // percent-encoding inválido: trata como literal
  }
  if (existsSync(join(PUBLIC_DIR, decoded))) return { kind: "ok" };

  const candidates = index.get(basename(decoded)) ?? [];
  if (candidates.length === 1) return { kind: "fixed", to: candidates[0]! };
  if (candidates.length === 0) return { kind: "missing" };
  return { kind: "ambiguous", candidates };
}

interface Row {
  id: string;
  slug: string | null;
  name: string;
  images: unknown;
  videos: unknown;
}

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const { url, serviceKey, orgSlug } = requireServiceRoleEnv();
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: org, error: orgError } = await db
    .from("organizations")
    .select("id, display_name")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!org) throw new Error(`Nenhuma org com slug "${orgSlug}".`);
  console.info(`Org: ${org.display_name} (${org.id})`);

  const index = indexPublicFiles();
  console.info(`Arquivos indexados em public/: ${[...index.values()].flat().length}`);

  const { data, error } = await db
    .from("products")
    .select("id, slug, name, images, videos")
    .eq("organization_id", org.id);
  if (error) throw error;

  const changes: Array<{ id: string; name: string; images: string[]; videos: string[] }> = [];
  const report: Array<Record<string, string>> = [];

  for (const row of (data ?? []) as Row[]) {
    let dirty = false;
    const next: Record<"images" | "videos", string[]> = { images: [], videos: [] };

    for (const field of ["images", "videos"] as const) {
      for (const entry of asStrings(row[field])) {
        const verdict = judge(entry, index);
        if (verdict.kind === "fixed") {
          dirty = true;
          next[field].push(verdict.to);
          report.push({ produto: row.name, campo: field, antes: entry, depois: verdict.to, motivo: "1 match" });
        } else {
          next[field].push(entry);
          if (verdict.kind === "missing") {
            report.push({ produto: row.name, campo: field, antes: entry, depois: "—", motivo: "arquivo nao existe" });
          } else if (verdict.kind === "ambiguous") {
            report.push({
              produto: row.name, campo: field, antes: entry, depois: "—",
              motivo: `ambiguo (${verdict.candidates.length} matches)`,
            });
          }
        }
      }
    }

    if (dirty) changes.push({ id: row.id, name: row.name, images: next.images, videos: next.videos });
  }

  if (report.length === 0) {
    console.info("\nNenhum caminho quebrado. Nada a fazer.");
    return;
  }
  console.table(report);

  const fixable = changes.length;
  const unfixable = report.filter((r) => r.depois === "—").length;
  console.info(`\nCorrigíveis: ${fixable} produto(s). Reportados sem correção: ${unfixable} caminho(s).`);

  if (dryRun) {
    console.info("--dry-run: nada foi gravado.");
    return;
  }
  if (fixable === 0) return;

  for (const change of changes) {
    const { error: updateError } = await db
      .from("products")
      .update({ images: change.images, videos: change.videos })
      .eq("organization_id", org.id)
      .eq("id", change.id);
    if (updateError) throw updateError;
    console.info(`corrigido: ${change.name}`);
  }
  console.info(`\nGravados: ${fixable} produto(s).`);
  console.info("A vitrine usa cache com tag — edite qualquer coisa no Landing Edit ou faça um deploy para revalidar.");
}

main().catch((error: unknown) => {
  console.error("Falhou:", error instanceof Error ? error.message : error);
  process.exit(1);
});
