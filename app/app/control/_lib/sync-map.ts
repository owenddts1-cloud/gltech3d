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

export interface ToolTarget {
  name: string;
  purchaseValueCents: number;
  quantity: number;
  purchaseDate: string | null;
}

export interface ConsumableTarget {
  name: string;
  stockGrams: number;
  costPerKgCents: number;
}

export interface SyncPlan {
  sales: SaleTarget[];
  /** Nomes de clientes únicos (das vendas) para virar contatos. */
  contactNames: string[];
  tools: ToolTarget[];
  consumables: ConsumableTarget[];
}

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

/** Monta o plano de sincronização a partir das linhas da planilha. Deduplica dentro do plano. */
export function planControlSync(rows: SyncSourceRow[]): SyncPlan {
  const sales: SaleTarget[] = [];
  const contactSet = new Set<string>();
  const toolByName = new Map<string, ToolTarget>();
  const consumableByName = new Map<string, ConsumableTarget>();

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
      if (client) contactSet.add(customerName);
      continue;
    }

    // ── Ferramentas → inventário (dedup por nome) ──
    if (category === "Ferramentas" && desc) {
      const key = desc.toLowerCase();
      if (!toolByName.has(key)) {
        toolByName.set(key, {
          name: desc,
          purchaseValueCents: num(r.expense_cents),
          quantity: Math.max(1, Math.round(num(r.quantity)) || 1),
          purchaseDate: r.date || null,
        });
      }
      continue;
    }

    // ── Filamentos → consumíveis (dedup por nome; assume bobina de 1kg) ──
    if (category === "Filamentos" && desc) {
      const key = desc.toLowerCase();
      if (!consumableByName.has(key)) {
        const qty = Math.max(1, Math.round(num(r.quantity)) || 1);
        consumableByName.set(key, {
          name: desc,
          stockGrams: qty * 1000,
          costPerKgCents: Math.round(num(r.expense_cents) / qty),
        });
      }
      continue;
    }
  }

  return {
    sales,
    contactNames: Array.from(contactSet),
    tools: Array.from(toolByName.values()),
    consumables: Array.from(consumableByName.values()),
  };
}
