/**
 * Lógica PURA da sincronização "Controle → módulos" (botão Sincronizar da planilha).
 *
 * Transforma linhas da planilha (financial_records) em payloads para os módulos de domínio.
 * Sem I/O — testável sem banco. A server action ([app/actions/control/sync.ts]) busca o que
 * já existe, dedup contra este plano e insere só o que falta (idempotente).
 *
 * PREMISSAS (documentadas porque a planilha é livre):
 *  - Linha de VENDA = categoria "Venda". O NOME DO CLIENTE vem da coluna `description`
 *    (é onde o usuário "colocou os nomes"). Valor = revenue_cents.
 *  - Linha de FERRAMENTA = categoria "Ferramentas" → inventory_assets (category 'ferramenta'),
 *    valor de compra = expense_cents, quantidade = quantity.
 *  - Linha de FILAMENTO = categoria "Filamentos" → consumables (filamento). Assume-se bobina
 *    de 1kg: estoque = quantity × 1000 g; custo/kg = expense_cents ÷ quantity.
 */

export const MARKETPLACE_PLATFORMS = ["B2B", "Shopee", "Facebook", "Mercado Livre", "TikTok Shop", "Olx", "Outro"] as const;
export type MarketplacePlatform = (typeof MARKETPLACE_PLATFORMS)[number];

export interface SyncSourceRow {
  id: string;
  date: string;
  description: string | null;
  type: string;
  category: string | null;
  platform: string | null;
  revenue_cents: number;
  expense_cents: number;
  quantity: number;
}

export interface SaleTarget {
  /** Chave estável p/ idempotência: `ctrl:<financial_record.id>`. */
  key: string;
  /** Produto/serviço vendido (parte antes de " - " na descrição) — vira o título da O.S. */
  productName: string;
  /** Cliente (parte depois de " - ") — vira o contato e o `contact_name` da O.S. */
  customerName: string;
  platform: MarketplacePlatform;
  totalCents: number;
  soldAt: string;
  osTitle: string;
}

/** Item de inventário derivado do Controle: ferramentas, insumos e peças. */
export interface InventoryTarget {
  name: string;
  purchaseValueCents: number;
  quantity: number;
  purchaseDate: string | null;
  /** Categoria do inventory_assets (check: só 'ferramenta' ou 'outro' aqui). */
  category: "ferramenta" | "outro";
  /** Destino/uso (Ferramenta, Insumo, Peça…). */
  purpose: string;
}

/** Filamento → tabela `filaments` (módulo Impressoras & Filamentos). */
export interface FilamentTarget {
  /** Idempotência: unique (org, client_id). Estável por nome. */
  clientId: string;
  name: string;
  weightGrams: number;
  costPerGram: number;
  minWeightAlert: number;
}

export interface SyncPlan {
  sales: SaleTarget[];
  /** Nomes de clientes únicos (das vendas) para virar contatos. */
  contactNames: string[];
  /** Ferramentas + Insumos + Peças → inventory_assets (classificados por purpose). */
  inventory: InventoryTarget[];
  /** Filamentos → tabela `filaments` (Impressoras & Filamentos). */
  filaments: FilamentTarget[];
}

/**
 * Nomes de cliente que são o DONO da oficina — não viram contato no Sincronizar.
 * O Guilherme ("Gui") entrou como contato pelo formulário da landing; não deve
 * ser recriado como cliente ao sincronizar as vendas. Edite esta lista se mudar.
 */
export const SYNC_OWNER_NAMES = ["gui"];

const num = (v: unknown): number => (v == null ? 0 : Number(v) || 0);
const norm = (s: string | null | undefined): string => (s ?? "").trim();

function toPlatform(raw: string | null): MarketplacePlatform {
  const p = norm(raw);
  return (MARKETPLACE_PLATFORMS as readonly string[]).includes(p) ? (p as MarketplacePlatform) : "Outro";
}

/**
 * Separa a descrição da venda em produto + cliente. Convenção da planilha: "Produto - Cliente"
 * (ex.: "Letreiro - Taís Porfírio"). Usa o ÚLTIMO " - " para o produto poder conter hífen
 * (ex.: "Maxilar 3D - Wellington Denise"). Sem " - ": tudo vira produto e não há cliente.
 */
function parseSale(desc: string): { product: string; client: string } {
  const sep = desc.lastIndexOf(" - ");
  if (sep > 0) {
    const product = desc.slice(0, sep).trim();
    const client = desc.slice(sep + 3).trim();
    if (product && client) return { product, client };
  }
  return { product: desc || "Venda", client: "" };
}

const isOwner = (name: string): boolean => SYNC_OWNER_NAMES.includes(name.trim().toLowerCase());

/** Categorias do Controle que viram item de inventário, com categoria + destino. */
const INVENTORY_CATEGORY_MAP: Record<string, { category: "ferramenta" | "outro"; purpose: string }> = {
  Ferramentas: { category: "ferramenta", purpose: "Ferramenta" },
  Insumo: { category: "outro", purpose: "Insumo" },
  Insumos: { category: "outro", purpose: "Insumo" },
  Peças: { category: "outro", purpose: "Peça" },
  Pecas: { category: "outro", purpose: "Peça" },
};

/** Monta o plano de sincronização a partir das linhas da planilha. Deduplica dentro do plano. */
export function planControlSync(rows: SyncSourceRow[]): SyncPlan {
  const sales: SaleTarget[] = [];
  const contactSet = new Set<string>();
  const inventoryByName = new Map<string, InventoryTarget>();
  const filamentByName = new Map<string, FilamentTarget>();

  for (const r of rows) {
    const category = norm(r.category);
    const desc = norm(r.description);

    // ── Vendas (categoria "Venda", receita > 0) ──
    if (category === "Venda" && num(r.revenue_cents) > 0) {
      const { product, client } = parseSale(desc);
      const customerName = client || "Cliente sem nome";
      sales.push({
        key: `ctrl:${r.id}`,
        productName: product,
        customerName,
        platform: toPlatform(r.platform),
        totalCents: num(r.revenue_cents),
        soldAt: r.date,
        osTitle: product,
      });
      // Cria contato só se há cliente de verdade e não é o dono (Gui).
      if (client && !isOwner(client)) contactSet.add(customerName);
      continue;
    }

    // ── Ferramentas / Insumos / Peças → inventário (classificado por purpose; dedup por nome) ──
    const invMap = INVENTORY_CATEGORY_MAP[category];
    if (invMap && desc) {
      const key = desc.toLowerCase();
      if (!inventoryByName.has(key)) {
        inventoryByName.set(key, {
          name: desc,
          purchaseValueCents: num(r.expense_cents),
          quantity: Math.max(1, Math.round(num(r.quantity)) || 1),
          purchaseDate: r.date || null,
          category: invMap.category,
          purpose: invMap.purpose,
        });
      }
      continue;
    }

    // ── Filamentos → tabela `filaments` (dedup por nome; assume bobina de 1kg) ──
    if (category === "Filamentos" && desc) {
      const key = desc.toLowerCase();
      if (!filamentByName.has(key)) {
        const qty = Math.max(1, Math.round(num(r.quantity)) || 1);
        const grams = qty * 1000;
        filamentByName.set(key, {
          clientId: `ctrl:${key}`,
          name: desc,
          weightGrams: grams,
          // custo por grama em reais: (despesa total em R$) ÷ gramas.
          costPerGram: grams > 0 ? Math.round(((num(r.expense_cents) / 100) / grams) * 10000) / 10000 : 0,
          minWeightAlert: 0,
        });
      }
      continue;
    }
  }

  return {
    sales,
    contactNames: Array.from(contactSet),
    inventory: Array.from(inventoryByName.values()),
    filaments: Array.from(filamentByName.values()),
  };
}
