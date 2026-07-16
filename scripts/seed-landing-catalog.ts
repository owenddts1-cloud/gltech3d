/**
 * Importa o catálogo estático da landing (`lib/marketing/products.ts`) para a
 * tabela `products`, que passou a ser a fonte de verdade única (migration 0041).
 *
 * Roda uma vez na migração do arquivo → banco. Idempotente: casa pelo slug e
 * atualiza o que já existe, então re-rodar não duplica.
 *
 * NÃO é migration de propósito: um clone open-source não deve receber o catálogo
 * da GLTech3D. A doutrina do repo proíbe hardcode de tenant em migrations.
 *
 * Uso:
 *   npx tsx scripts/seed-landing-catalog.ts            # aplica
 *   npx tsx scripts/seed-landing-catalog.ts --dry-run  # só mostra o que faria
 *
 * A org vem de LANDING_ORG_SLUG (default: gltech3d).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { products } from "../lib/marketing/products";

function loadEnvFiles(): void {
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

/** "Luminária Lua Cheia - Alta Qualidade" → "luminaria-lua-cheia-alta-qualidade" */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tira os diacriticos separados pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function main(): Promise<void> {
  loadEnvFiles();
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  }
  const orgSlug = process.env.LANDING_ORG_SLUG ?? "gltech3d";

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: org, error: orgError } = await db
    .from("organizations")
    .select("id, display_name")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!org) throw new Error(`Nenhuma org com slug "${orgSlug}".`);

  console.info(`Org: ${org.display_name} (${org.id})`);
  console.info(`Produtos no arquivo estático: ${products.length}`);

  // Slug duplicado entre dois produtos quebraria o upsert silenciosamente
  // (o segundo sobrescreveria o primeiro). Melhor abortar antes de gravar.
  const seen = new Map<string, string>();
  for (const p of products) {
    const slug = slugify(p.name);
    const clash = seen.get(slug);
    if (clash) throw new Error(`Slug duplicado "${slug}": "${clash}" e "${p.name}".`);
    seen.set(slug, p.name);
  }

  // Upsert por (organization_id, slug) NÃO funciona: aquele índice único é
  // parcial (`where slug is not null`) e o Postgres não infere ON CONFLICT a
  // partir de índice parcial. Então resolvemos o id do que já existe e o upsert
  // roda pela PK, que é uma constraint única de verdade.
  const { data: existing, error: existingError } = await db
    .from("products")
    .select("id, slug")
    .eq("organization_id", org.id)
    .not("slug", "is", null);
  if (existingError) throw existingError;

  const idBySlug = new Map<string, string>(
    (existing ?? []).map((row) => [row.slug as string, row.id as string]),
  );

  const rows = products.map((p, index) => {
    // `image` é a capa e `images` a galeria; no banco vira uma lista só, capa
    // primeiro e sem repetição. pendingPhoto = galeria vazia (derivado na leitura).
    const gallery = p.pendingPhoto ? [] : Array.from(new Set([p.image, ...p.images]));
    const slug = slugify(p.name);

    return {
      // id explícito em toda linha: deixa o upsert rodar pela PK de forma
      // uniforme (existentes atualizam, novos inserem).
      id: idBySlug.get(slug) ?? randomUUID(),
      organization_id: org.id,
      slug,
      name: p.name,
      description: p.description,
      category: p.category,
      images: gallery,
      videos: p.videos ?? [],
      colors: p.colors,
      links: p.links,
      material: p.material,
      dimensions: p.dimensions,
      hero_copy: p.heroCopy ?? null,
      price_range: p.priceRange ?? null,
      sale_price_cents: Math.round(p.price * 100),
      is_top: p.isTop,
      bestseller_rank: p.bestsellerRank ?? null,
      sort_order: index + 1,
      // Tudo que já estava no ar continua no ar.
      is_published: true,
      stock_qty: 0,
      sold_qty: 0,
    };
  });

  if (dryRun) {
    console.table(
      rows.map((r) => ({
        slug: r.slug,
        novo: idBySlug.has(r.slug) ? "nao" : "sim",
        categoria: r.category,
        preco: (r.sale_price_cents / 100).toFixed(2),
        fotos: (r.images as string[]).length,
        podio: r.bestseller_rank ?? "-",
      })),
    );
    console.info("\n--dry-run: nada foi gravado.");
    return;
  }

  const { data, error } = await db
    .from("products")
    .upsert(rows, { onConflict: "id" })
    .select("id, slug");
  if (error) throw error;

  console.info(`\nGravados: ${data?.length ?? 0} produtos.`);

  const { count } = await db
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("is_published", true);
  console.info(`Publicados na org: ${count}`);
}

main().catch((error: unknown) => {
  console.error("Falhou:", error instanceof Error ? error.message : error);
  process.exit(1);
});
