/**
 * Zod da fronteira das Server Actions do Landing Edit. Todo input externo passa
 * por aqui (CLAUDE.md: Zod em todo input externo).
 *
 * O que é do PRODUTO mora em `products-catalog.ts` — `products` é uma tabela só,
 * servindo o CRM e a vitrine. Este módulo ficou com o que é da PÁGINA: seções,
 * banners, comissões de plataforma, nichos e o pódio.
 *
 * Historicamente havia aqui uma segunda definição dos campos de produto, e ela
 * divergiu da de `products-catalog.ts` em `images` — divergência que quebrou a
 * edição de todo produto com foto. Por isso agora há um schema só.
 */
import { z } from "zod";
import { mediaPath, linksSchema, productFullPatchSchema } from "./products-catalog";

export { linksSchema };

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
 * @deprecated Use `productFullPatchSchema` de `./products-catalog`. Alias mantido
 * para os callers do Landing Edit — é literalmente o mesmo schema.
 */
export const landingProductPatchSchema = productFullPatchSchema;

export type LandingProductPatch = z.infer<typeof productFullPatchSchema>;

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

export const reorderProductsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
});

