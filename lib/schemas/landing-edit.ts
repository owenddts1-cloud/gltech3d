/**
 * Zod da fronteira das Server Actions do Landing Edit. Todo input externo passa
 * por aqui (CLAUDE.md: Zod em todo input externo).
 *
 * Separado de `products-catalog.ts` porque aquele valida `images` como URL
 * absoluta, e a landing usa caminhos relativos servidos de /public
 * (ex.: "/images/Luminarias/Lua Cheia/luminarialuacheia1.png").
 */
import { z } from "zod";

/** Caminho de /public ou URL absoluta (Supabase Storage, quando houver upload). */
const mediaPath = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), {
    message: "Use um caminho de /public ou uma URL http(s).",
  });

const externalUrl = z.string().trim().url().max(1000).or(z.literal(""));

export const linksSchema = z
  .object({
    shopee: externalUrl,
    mercadoLivre: externalUrl,
    whatsapp: externalUrl,
    instagram: externalUrl,
  })
  .partial();

/** Plataformas conhecidas — espelha o check de platform_commissions (0041). */
export const PLATFORMS = [
  "B2B",
  "Shopee",
  "Facebook",
  "Mercado Livre",
  "TikTok Shop",
  "Olx",
  "Outro",
] as const;

export const platformSchema = z.enum(PLATFORMS);

/**
 * Patch parcial de um produto. Todo campo é opcional de propósito: o autosave
 * manda só o que sujou, não o objeto inteiro.
 */
export const landingProductPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9-]+$/, "Só minúsculas, números e hífen."),
    description: z.string().trim().max(2000),
    category: z.string().trim().max(80),
    heroCopy: z.string().trim().max(2000).nullable(),
    priceRange: z.string().trim().max(60).nullable(),
    material: z.string().trim().max(120),
    dimensions: z.string().trim().max(120),
    salePriceCents: z.coerce.number().int().nonnegative().max(100_000_000).nullable(),
    colors: z.array(z.string().trim().min(1).max(60)).max(20),
    images: z.array(mediaPath).max(20),
    videos: z.array(mediaPath).max(10),
    links: linksSchema,
    isPublished: z.boolean(),
    isTop: z.boolean(),
    stockQty: z.coerce.number().int().nonnegative().max(1_000_000),
    soldQty: z.coerce.number().int().nonnegative().max(1_000_000),
    sortOrder: z.coerce.number(),
    // Engenharia de custo (mesmos campos de /app/products — a tabela é a mesma)
    filamentClientId: z.string().max(64).nullable(),
    filamentGrams: z.coerce.number().nonnegative().max(1_000_000),
    printTimeMinutes: z.coerce.number().nonnegative().max(100_000),
    printerClientId: z.string().max(64).nullable(),
    extraCost: z.coerce.number().nonnegative().max(1_000_000),
    marginPct: z.coerce.number().min(0).max(100_000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Patch vazio." });

export type LandingProductPatch = z.infer<typeof landingProductPatchSchema>;

const landingSectionItemSchema = z
  .object({
    icon: z.string().trim().max(40),
    title: z.string().trim().max(160),
    text: z.string().trim().max(600),
    author: z.string().trim().max(80),
    detail: z.string().trim().max(120),
  })
  .partial();

export const landingSectionSchema = z
  .object({
    eyebrow: z.string().trim().max(120),
    title: z.string().trim().max(200),
    subtitle: z.string().trim().max(400),
    /** Banner: caminho de /public ou URL do Storage. "" limpa. */
    image: mediaPath.or(z.literal("")),
    items: z.array(landingSectionItemSchema).max(12),
  })
  .partial();

export const landingSettingsPatchSchema = z
  .object({
    sections: z.record(z.string().min(1).max(60), landingSectionSchema),
    links: linksSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Patch vazio." });

/** Pódio: rank 1..3, ou null para tirar a peça de lá. */
export const bestsellerRankSchema = z.object({
  productId: z.string().uuid(),
  rank: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
});

export const commissionPatchSchema = z.object({
  platform: platformSchema,
  commissionPct: z.coerce.number().min(0).max(100),
});

export const createLandingProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(80).optional().default(""),
});

const categoryName = z.string().trim().min(1).max(80);

export const renameCategorySchema = z.object({
  from: categoryName,
  to: categoryName,
});

/** `to` vazio = peças ficam sem nicho (category = null). */
export const reassignCategorySchema = z.object({
  from: categoryName,
  to: z.string().trim().max(80),
});
