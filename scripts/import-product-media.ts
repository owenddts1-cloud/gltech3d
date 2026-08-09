/**
 * Sobe as fotos e vídeos de uma pasta por peça para o Supabase Storage e
 * atualiza `products.images` / `products.videos`.
 *
 * CONVENÇÃO DE PASTAS — o nome da pasta é o SLUG da peça:
 *
 *   media-import/
 *     luminaria-lua-cheia-alta-qualidade/
 *       capa.png          <- vai como images[0] (a capa da peça)
 *       02.png
 *       10.png            <- ordenação numérica: 2 antes de 10
 *       demo.mp4          <- vai para `videos`
 *
 * Se o nome da pasta não bater com nenhum slug, o script NÃO adivinha: ele lista
 * as pastas órfãs e as peças mais parecidas, e você resolve com `--map`.
 *
 * IDEMPOTÊNCIA POR CONTEÚDO: o caminho no Storage é
 * `<orgId>/<sha256(arquivo)[0:12]>-<nome-seguro>`. Re-rodar com os mesmos
 * arquivos gera os mesmos caminhos, então nada duplica. (O upload pela interface
 * usa UUID e não deduplica — quem precisa ser re-executável é este script.)
 *
 * Por padrão o modo é APPEND-MISSING: só acrescenta o que falta, nunca remove
 * foto que você subiu pela tela. `--replace` troca a lista inteira.
 *
 * Uso:
 *   npx tsx scripts/import-product-media.ts --dry-run
 *   npx tsx scripts/import-product-media.ts --only luminaria-lua-cheia-alta-qualidade
 *   npx tsx scripts/import-product-media.ts --root "D:/fotos" --map media-map.json
 *   npx tsx scripts/import-product-media.ts --from-public   # propõe o mapa da árvore atual
 *
 * Flags: --dry-run · --root <dir> · --map <json> · --only <slug> · --replace · --from-public
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

import { requireServiceRoleEnv } from "./_env";
import { slugify } from "../lib/utils/slug";
import { matchProductByFolder, nearestSlugs } from "../lib/products/media-match";
import {
  LANDING_MEDIA_BUCKET,
  LANDING_MEDIA_MAX_BYTES,
  safeName,
  mediaKindOf,
  mimeFromExtension,
  compareMediaNames,
} from "../lib/landing/media-config";

interface Args {
  dryRun: boolean;
  replace: boolean;
  fromPublic: boolean;
  root: string;
  map: string | null;
  only: string | null;
}

function parseArgs(argv: string[]): Args {
  const flag = (name: string): string | null => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : null;
  };
  return {
    dryRun: argv.includes("--dry-run"),
    replace: argv.includes("--replace"),
    fromPublic: argv.includes("--from-public"),
    root: flag("--root") ?? "media-import",
    map: flag("--map"),
    only: flag("--only"),
  };
}

interface Candidate {
  absPath: string;
  name: string;
  kind: "image" | "video";
  mime: string;
  sizeBytes: number;
}

/** Arquivos de mídia de uma pasta (não recursivo), já ordenados. */
function collectMedia(dir: string): { usable: Candidate[]; skipped: string[] } {
  const usable: Candidate[] = [];
  const skipped: string[] = [];

  for (const entry of readdirSync(dir)) {
    const absPath = join(dir, entry);
    if (statSync(absPath).isDirectory()) continue;

    const mime = mimeFromExtension(entry);
    if (!mime) {
      skipped.push(`${entry} (extensão não suportada)`);
      continue;
    }
    const sizeBytes = statSync(absPath).size;
    if (sizeBytes > LANDING_MEDIA_MAX_BYTES) {
      skipped.push(`${entry} (${Math.round(sizeBytes / 1024 / 1024)} MB — limite é 50 MB)`);
      continue;
    }
    usable.push({ absPath, name: entry, kind: mediaKindOf(entry), mime, sizeBytes });
  }

  usable.sort((a, b) => compareMediaNames(a.name, b.name));
  return { usable, skipped };
}

/** Caminho determinístico: mesmo conteúdo ⇒ mesmo caminho ⇒ nunca duplica. */
export function storagePathFor(orgId: string, content: Buffer, filename: string): string {
  const digest = createHash("sha256").update(content).digest("hex").slice(0, 12);
  return `${orgId}/${digest}-${safeName(filename)}`;
}

interface ProductRow {
  id: string;
  slug: string | null;
  name: string;
  images: unknown;
  videos: unknown;
}

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Sugere pasta → slug a partir da árvore de `public/`, sem gravar nada. */
function proposeMapFromPublic(products: ProductRow[]): void {
  const proposal: Record<string, string> = {};
  for (const root of ["public/images", "public/videos"]) {
    if (!existsSync(root)) continue;
    for (const category of readdirSync(root)) {
      const categoryDir = join(root, category);
      if (!statSync(categoryDir).isDirectory()) continue;
      for (const piece of readdirSync(categoryDir)) {
        const pieceDir = join(categoryDir, piece);
        if (!statSync(pieceDir).isDirectory()) continue;
        const match = matchProductByFolder(piece, products);
        proposal[`${category}/${piece}`] =
          match.kind === "exact" || match.kind === "contained"
            ? (match.product.slug ?? slugify(match.product.name))
            : `??? (${piece} — ${match.kind === "ambiguous" ? "ambiguo" : "sem correspondencia"})`;
      }
    }
  }
  console.info("\nProposta de mapa (revise e salve como media-map.json):\n");
  console.info(JSON.stringify(proposal, null, 2));
  console.info("\nDepois: npx tsx scripts/import-product-media.ts --root public/images --map media-map.json --dry-run");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
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

  const { data: productData, error: productError } = await db
    .from("products")
    .select("id, slug, name, images, videos")
    .eq("organization_id", org.id);
  if (productError) throw productError;
  const products = (productData ?? []) as ProductRow[];

  if (args.fromPublic) {
    proposeMapFromPublic(products);
    return;
  }

  if (!existsSync(args.root)) {
    throw new Error(
      `Pasta "${args.root}" não existe. Crie-a com uma subpasta por peça (nome = slug), ou passe --root.`,
    );
  }

  const folderToSlug: Record<string, string> = args.map
    ? (JSON.parse(readFileSync(args.map, "utf8")) as Record<string, string>)
    : {};

  const bySlug = new Map(products.filter((p) => p.slug).map((p) => [p.slug as string, p]));
  const byNameSlug = new Map(products.map((p) => [slugify(p.name), p]));

  // Lista o que já está no bucket: dedup sem baixar nada.
  const { data: existingObjects } = await db.storage
    .from(LANDING_MEDIA_BUCKET)
    .list(org.id, { limit: 10_000 });
  const alreadyUploaded = new Set((existingObjects ?? []).map((o) => `${org.id}/${o.name}`));

  const folders = readdirSync(args.root).filter((f) => statSync(join(args.root, f)).isDirectory());
  if (folders.length === 0) throw new Error(`Nenhuma subpasta em "${args.root}".`);

  const orphans: string[] = [];
  const report: Array<Record<string, string | number>> = [];
  let uploadedCount = 0;
  let reusedCount = 0;

  for (const folder of folders) {
    // Mapa explícito vence sempre: se o usuário apontou, não há o que inferir.
    const mapped = folderToSlug[folder];
    const key = mapped ?? slugify(folder);
    let product = mapped ? (bySlug.get(mapped) ?? byNameSlug.get(mapped)) : undefined;

    if (!product) {
      const match = matchProductByFolder(folder, products);
      if (match.kind === "exact" || match.kind === "contained") {
        product = products.find((p) => p.id === match.product.id);
      } else if (match.kind === "ambiguous") {
        orphans.push(
          `${folder}  →  ambíguo, casa com ${match.candidates.length} peças: ` +
            match.candidates.map((c) => c.slug ?? slugify(c.name)).join(", "),
        );
        continue;
      }
    }

    if (!product) {
      orphans.push(
        `${folder}  →  sem peça correspondente. Próximos: ${nearestSlugs(folder, products).join(", ")}`,
      );
      continue;
    }
    if (args.only && product.slug !== args.only && key !== args.only) continue;

    const { usable, skipped } = collectMedia(join(args.root, folder));
    for (const reason of skipped) {
      report.push({ peca: product.name, arquivo: reason, acao: "ignorado" });
    }

    const nextImages = args.replace ? [] : asStrings(product.images);
    const nextVideos = args.replace ? [] : asStrings(product.videos);

    for (const candidate of usable) {
      const content = readFileSync(candidate.absPath);
      const path = storagePathFor(org.id, content, candidate.name);
      const publicUrl = db.storage.from(LANDING_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
      const target = candidate.kind === "image" ? nextImages : nextVideos;

      if (target.includes(publicUrl)) {
        report.push({ peca: product.name, arquivo: candidate.name, acao: "já vinculado" });
        continue;
      }

      if (alreadyUploaded.has(path)) {
        reusedCount++;
        report.push({ peca: product.name, arquivo: candidate.name, acao: "já no Storage" });
      } else if (!args.dryRun) {
        const { error: uploadError } = await db.storage
          .from(LANDING_MEDIA_BUCKET)
          .upload(path, content, { contentType: candidate.mime, upsert: false });
        // 409 = corrida com outro upload do MESMO conteúdo; o caminho é o mesmo,
        // então o arquivo que interessa já está lá.
        if (uploadError && !/exists/i.test(uploadError.message)) throw uploadError;
        uploadedCount++;
        alreadyUploaded.add(path);
        report.push({ peca: product.name, arquivo: candidate.name, acao: "enviado" });
      } else {
        uploadedCount++;
        report.push({ peca: product.name, arquivo: candidate.name, acao: "enviaria" });
      }

      target.push(publicUrl);
    }

    const imagesChanged = JSON.stringify(nextImages) !== JSON.stringify(asStrings(product.images));
    const videosChanged = JSON.stringify(nextVideos) !== JSON.stringify(asStrings(product.videos));
    if ((imagesChanged || videosChanged) && !args.dryRun) {
      const { error: updateError } = await db
        .from("products")
        .update({ images: nextImages, videos: nextVideos })
        .eq("organization_id", org.id)
        .eq("id", product.id);
      if (updateError) throw updateError;
    }
  }

  if (report.length > 0) console.table(report);
  if (orphans.length > 0) {
    console.warn("\nPastas sem peça correspondente (nada foi feito com elas):");
    for (const line of orphans) console.warn(`  ${line}`);
    console.warn("Resolva com --map media-map.json ou renomeie a pasta para o slug da peça.");
  }

  console.info(
    `\n${args.dryRun ? "[dry-run] " : ""}Arquivos ${args.dryRun ? "a enviar" : "enviados"}: ${uploadedCount}` +
      ` · reaproveitados do Storage: ${reusedCount}`,
  );
  if (args.dryRun) {
    console.info("--dry-run: nada foi enviado nem gravado.");
  } else {
    console.info("Edite qualquer campo no CRM (ou faça um deploy) para a vitrine revalidar o cache.");
  }
}

main().catch((error: unknown) => {
  console.error("Falhou:", error instanceof Error ? error.message : error);
  process.exit(1);
});
