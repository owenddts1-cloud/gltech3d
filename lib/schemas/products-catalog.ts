/**
 * Zod schemas for the products catalog (BOM). External input at the
 * server-action boundary. Distinct from `lib/marketing/products.ts` (static
 * landing catalog).
 */
import { z } from "zod";

/**
 * Caminho de mídia: servido de `/public` ou URL absoluta http(s) do Storage.
 *
 * Este schema mora aqui, e não em `landing-edit.ts`, porque `products` é UMA
 * tabela só — a mesma coluna `images` alimenta o CRM e a vitrine pública. Ter
 * duas definições foi exatamente o que produziu o bug abaixo.
 *
 * REGRESSÃO QUE ISTO TRAVA: este campo já foi `z.string().url()`, que exige URL
 * absoluta. Mas o seed gravou caminhos relativos (`/images/Luminarias/...`) e o
 * formulário reenvia `images` a cada gravação — então `updateProduct` reprovava
 * no Zod e devolvia "Dados inválidos" para TODO produto que tivesse foto. Os
 * produtos sem foto (`images: []`) salvavam, o que escondeu a falha.
 *
 * O `!startsWith("//")` recusa URL protocol-relative (`//host/x.png`), que
 * passaria no teste de "começa com /" e carregaria de um host externo.
 */
export const mediaPath = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((v) => (v.startsWith("/") && !v.startsWith("//")) || /^https?:\/\//.test(v), {
    message: "Use um caminho de /public ou uma URL http(s).",
  });

/** URL de canal de venda. `""` é válido e significa "herda o link global da loja". */
const externalUrl = z.string().trim().url().max(1000).or(z.literal(""));

/**
 * Canais de venda do produto. Chave ausente ou vazia cai no link global da org
 * (`landing_settings.links`) — ver `mergeProductLinks` em `lib/landing/links.ts`.
 */
export const linksSchema = z
  .object({
    shopee: externalUrl,
    mercadoLivre: externalUrl,
    whatsapp: externalUrl,
    instagram: externalUrl,
  })
  .partial();

/**
 * Variação = grupo de atributo da vitrine (migration 0059). Ex.: { name: "Tamanho",
 * options: ["P","M","G"] }. A landing exibe cada grupo como um conjunto de opções.
 */
export const productVariationGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  options: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
});
export type ProductVariationGroup = z.infer<typeof productVariationGroupSchema>;

/**
 * Insumo do BOM: uma linha de `products.extra_costs`.
 *
 * O jsonb sempre suportou uma lista; quem colapsava tudo em um item rotulado
 * "Insumos" era a UI. Rótulo vazio é aceito de propósito — obrigar um nome faria
 * o usuário inventar um.
 */
export const extraCostItemSchema = z.object({
  label: z.string().trim().max(80).default(""),
  costCents: z.coerce.number().int().nonnegative().max(100_000_000),
});
export type ExtraCostItem = z.infer<typeof extraCostItemSchema>;

/**
 * TODOS os campos editáveis de `products`, em camelCase.
 *
 * Fonte única: `products` é uma tabela só, servindo o CRM e a vitrine pública.
 * Antes existiam dois schemas paralelos (aqui e em `landing-edit.ts`) e eles já
 * tinham divergido em `images` — ver o comentário de `mediaPath`.
 *
 * `bestsellerRank` NÃO entra aqui: o índice único parcial da migration 0041
 * exige liberar o degrau antes de ocupá-lo, o que só `setBestsellerRank` faz.
 * Num patch genérico ele voltaria como erro 23505.
 */
const productFieldsShape = {
  // ── Identificação ────────────────────────────────────────────────────────
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Só minúsculas, números e hífen."),
  category: z.string().trim().max(80),
  /** FK → categories.id (migration 0055). Preferred over text `category`. */
  categoryId: z.string().uuid().nullable(),
  description: z.string().trim().max(2000),
  heroCopy: z.string().trim().max(2000).nullable(),

  // ── Vitrine ──────────────────────────────────────────────────────────────
  material: z.string().trim().max(120),
  dimensions: z.string().trim().max(120),
  colors: z.array(z.string().trim().min(1).max(60)).max(20),
  variations: z.array(productVariationGroupSchema).max(20),
  priceRange: z.string().trim().max(60).nullable(),
  isTop: z.boolean(),
  /** Visibilidade na landing (`is_published`). Publicar exige preço de venda. */
  isPublished: z.boolean(),

  // ── Mídia ────────────────────────────────────────────────────────────────
  images: z.array(mediaPath).max(20),
  videos: z.array(mediaPath).max(10),

  // ── Comercial ────────────────────────────────────────────────────────────
  salePriceCents: z.coerce.number().int().nonnegative().max(100_000_000).nullable(),
  /** @deprecated Preço em reais. Use `salePriceCents`; o mapper aceita os dois. */
  salePrice: z.coerce.number().nonnegative().max(1_000_000).nullable(),
  stockQty: z.coerce.number().int().nonnegative().max(1_000_000),
  soldQty: z.coerce.number().int().nonnegative().max(1_000_000),
  links: linksSchema,

  // ── Engenharia de custo ──────────────────────────────────────────────────
  filamentClientId: z.string().max(64).nullable(),
  filamentGrams: z.coerce.number().nonnegative().max(1_000_000),
  /** Tempo de impressão em MINUTOS (o mapper converte para segundos). */
  printTimeMinutes: z.coerce.number().nonnegative().max(100_000),
  printerClientId: z.string().max(64).nullable(),
  extraCosts: z.array(extraCostItemSchema).max(20),
  /** @deprecated Soma em reais; colapsa o BOM em um item. Use `extraCosts`. */
  extraCost: z.coerce.number().nonnegative().max(1_000_000),
  marginPct: z.coerce.number().min(0).max(100_000),

  // ── Interno (nunca vai para a landing) ───────────────────────────────────
  observations: z.string().trim().max(2000).nullable(),
  /** Quem costuma comprar a peça (migration 0069). Interno, como observations. */
  buyerProfile: z.string().trim().max(2000).nullable(),
  /**
   * Origem do modelo 3D (migration 0073). Decide o que pode ser distribuído como
   * ARQUIVO — vender a peça impressa e redistribuir o STL são coisas diferentes.
   */
  modelSource: z.enum(["proprio", "livre", "terceiro", "desconhecido"]),
  /** Licença ou fonte do modelo, em texto livre. Interno. */
  modelLicense: z.string().trim().max(500).nullable(),

  /**
   * STL vinculado (0077). Nulo desfaz o vínculo.
   *
   * É o que permite a ficha estimar gramas e tempo pelo fatiador em vez de
   * exigir que alguém pese a peça e cronometre a impressão.
   */
  modelId: z.string().uuid().nullable(),
  /** Marcado pela ficha quando os números vieram do fatiador, não da balança. */
  costEstimatedAt: z.string().nullable(),
  costEstimateSource: z.record(z.unknown()),

  // ── Ordenação na vitrine ─────────────────────────────────────────────────
  sortOrder: z.coerce.number(),
} as const;

/**
 * Patch parcial. Todo campo é opcional de propósito: o autosave manda só o que
 * sujou, nunca o objeto inteiro.
 */
export const productFullPatchSchema = z
  .object(productFieldsShape)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Patch vazio." });

export type ProductFullPatch = z.infer<typeof productFullPatchSchema>;

/**
 * Criação: só `name` é obrigatório. Os defaults existem porque `createProduct`
 * usa os valores direto no INSERT e as colunas correspondentes são NOT NULL.
 */
export const productCreateSchema = z
  .object(productFieldsShape)
  .partial()
  .extend({
    name: productFieldsShape.name,
    category: productFieldsShape.category.optional().default(""),
    description: productFieldsShape.description.optional().default(""),
    filamentGrams: productFieldsShape.filamentGrams.optional().default(0),
    printTimeMinutes: productFieldsShape.printTimeMinutes.optional().default(0),
    extraCost: productFieldsShape.extraCost.optional().default(0),
    marginPct: productFieldsShape.marginPct.optional().default(100),
  });

export const productPatchSchema = productFullPatchSchema;

export type ProductCreate = z.infer<typeof productCreateSchema>;
