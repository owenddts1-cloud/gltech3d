import { describe, it, expect } from "vitest";

import {
  buildProductFeed,
  buildNicheCatalogMessages,
  absoluteUrl,
  availabilityOf,
  formatFeedPrice,
  FEED_COLUMNS,
} from "./feed";
import type { LandingProduct } from "./types";

/**
 * O feed é lido por um robô da Meta, não por uma pessoa. Campo mal formatado não
 * dá erro visível: o item some do catálogo em silêncio, ou pior, entra com preço
 * ou foto errada. Daí a densidade de asserções aqui.
 */

const SITE = "https://gltech3d.com.br";

function product(over: Partial<LandingProduct> = {}): LandingProduct {
  return {
    id: "1",
    slug: "luminaria-lua-cheia",
    name: "Luminária Lua Cheia",
    description: "Luminária em formato de lua",
    price: 44.9,
    category: "Luminárias",
    image: "/images/Luminarias/Lua Cheia/foto1.png",
    images: ["/images/Luminarias/Lua Cheia/foto1.png"],
    videos: [],
    isTop: false,
    pendingPhoto: false,
    material: "PLA",
    dimensions: "15cm",
    colors: [],
    variations: [],
    links: {},
    stockQty: 0,
    ...over,
  };
}

const rowsOf = (csv: string): string[] => csv.trim().split("\n");

describe("absoluteUrl", () => {
  it("transforma caminho de /public em URL absoluta", () => {
    expect(absoluteUrl("/images/foto.png", SITE)).toBe("https://gltech3d.com.br/images/foto.png");
  });

  it("codifica espaço no caminho — a Meta recusa URL inválida", () => {
    // "/images/Porta Celular/..." é um caminho real do catálogo.
    const url = absoluteUrl("/images/Porta Celular/x.png", SITE);
    expect(url).toBe("https://gltech3d.com.br/images/Porta%20Celular/x.png");
    expect(url).not.toContain(" ");
  });

  it("não codifica duas vezes um caminho já codificado", () => {
    expect(absoluteUrl("/images/Porta%20Celular/x.png", SITE)).toBe(
      "https://gltech3d.com.br/images/Porta%20Celular/x.png",
    );
  });

  it("deixa URL do Storage intacta", () => {
    const remote = "https://abc.supabase.co/storage/v1/object/public/landing-media/x.png";
    expect(absoluteUrl(remote, SITE)).toBe(remote);
  });

  it("não duplica barra quando a base termina em /", () => {
    expect(absoluteUrl("/a.png", "https://x.com/")).toBe("https://x.com/a.png");
  });
});

describe("availabilityOf", () => {
  it("sem peça pronta = available for order, não 'in stock'", () => {
    // A operação imprime sob demanda. Dizer "in stock" gera pedido que atrasa.
    expect(availabilityOf(product({ stockQty: 0 }))).toBe("available for order");
  });

  it("com peça pronta = in stock", () => {
    expect(availabilityOf(product({ stockQty: 3 }))).toBe("in stock");
  });
});

describe("formatFeedPrice", () => {
  it("sempre com duas casas e a moeda", () => {
    expect(formatFeedPrice(44.9)).toBe("44.90 BRL");
    expect(formatFeedPrice(12)).toBe("12.00 BRL");
  });
});

describe("buildProductFeed", () => {
  it("cabeçalho traz as colunas obrigatórias da Meta", () => {
    const { csv } = buildProductFeed([product()], { siteUrl: SITE, brand: "GLTech3D" });
    const header = rowsOf(csv)[0]!;
    for (const required of ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand"]) {
      expect(header, `falta a coluna ${required}`).toContain(required);
    }
    expect(header.split(",")).toHaveLength(FEED_COLUMNS.length);
  });

  it("monta a linha da peça com link e imagem absolutos", () => {
    const { csv, included } = buildProductFeed([product()], { siteUrl: SITE, brand: "GLTech3D" });
    expect(included).toBe(1);
    const row = rowsOf(csv)[1]!;
    expect(row).toContain('"luminaria-lua-cheia"');
    expect(row).toContain('"44.90 BRL"');
    expect(row).toContain('"https://gltech3d.com.br/product/luminaria-lua-cheia"');
    expect(row).toContain("https://gltech3d.com.br/images/");
    expect(row).toContain('"Luminárias"');
  });

  it("exclui peça sem preço", () => {
    // Entraria no anúncio como R$ 0,00.
    const r = buildProductFeed([product({ price: 0 })], { siteUrl: SITE, brand: "X" });
    expect(r.included).toBe(0);
    expect(r.skipped).toEqual([{ name: "Luminária Lua Cheia", reason: "sem-preco" }]);
  });

  it("exclui peça sem foto", () => {
    const r = buildProductFeed([product({ images: [], pendingPhoto: true })], {
      siteUrl: SITE, brand: "X",
    });
    expect(r.included).toBe(0);
    expect(r.skipped[0]!.reason).toBe("sem-foto");
  });

  it("descrição vazia cai para o nome, em vez de reprovar o item", () => {
    const { csv } = buildProductFeed([product({ description: "" })], { siteUrl: SITE, brand: "X" });
    expect(rowsOf(csv)[1]).toContain('"Luminária Lua Cheia","Luminária Lua Cheia"');
  });

  it("escapa aspas e achata quebra de linha", () => {
    // Aspas não escapadas quebram o parser da Meta e corrompem a linha inteira.
    const { csv } = buildProductFeed(
      [product({ name: 'Peça 15" grande', description: "linha um\nlinha dois" })],
      { siteUrl: SITE, brand: "X" },
    );
    const row = rowsOf(csv)[1]!;
    expect(row).toContain('""');
    expect(rowsOf(csv)).toHaveLength(2); // a quebra de linha não criou linha nova
    expect(row).toContain("linha um linha dois");
  });

  it("imagens extras vão no additional_image_link, separadas por vírgula", () => {
    const { csv } = buildProductFeed(
      [product({ images: ["/a.png", "/b.png", "/c.png"] })],
      { siteUrl: SITE, brand: "X" },
    );
    const row = rowsOf(csv)[1]!;
    expect(row).toContain("https://gltech3d.com.br/b.png,https://gltech3d.com.br/c.png");
  });

  it("toda linha tem o mesmo número de campos do cabeçalho", () => {
    const { csv } = buildProductFeed(
      [product(), product({ slug: "b", images: ["/x.png", "/y.png"] })],
      { siteUrl: SITE, brand: "X" },
    );
    const rows = rowsOf(csv);
    // Conta só as vírgulas FORA de aspas.
    const countFields = (line: string): number => {
      let fields = 1;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === "," && !inQuotes) fields++;
      }
      return fields;
    };
    for (const row of rows) expect(countFields(row)).toBe(FEED_COLUMNS.length);
  });

  it("catálogo vazio produz só o cabeçalho, sem quebrar", () => {
    const { csv, included } = buildProductFeed([], { siteUrl: SITE, brand: "X" });
    expect(included).toBe(0);
    expect(rowsOf(csv)).toHaveLength(1);
  });

  it("nenhuma linha vaza dado de custo", () => {
    // A garantia estrutural é a lista fechada do repositório; esta é a trava de
    // segunda camada, no caso de alguém acrescentar coluna ao view model.
    const { csv } = buildProductFeed([product()], { siteUrl: SITE, brand: "X" });
    for (const forbidden of ["filament", "grams", "margin", "extra_cost", "print_time", "custo"]) {
      expect(csv.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe("buildNicheCatalogMessages", () => {
  const items = [
    product({ slug: "a", name: "Vaso", category: "Decoração", price: 49.9 }),
    product({ slug: "b", name: "Batman", category: "Action Figure", price: 74.9 }),
    product({ slug: "c", name: "Charizard", category: "Action Figure", price: 29.9 }),
  ];

  it("agrupa por nicho, em ordem alfabética", () => {
    const messages = buildNicheCatalogMessages(items, { siteUrl: SITE, brand: "X" });
    expect(messages.map((m) => m.category)).toEqual(["Action Figure", "Decoração"]);
  });

  it("cada mensagem traz nome, preço em pt-BR e link da peça", () => {
    const [actionFigure] = buildNicheCatalogMessages(items, { siteUrl: SITE, brand: "X" });
    expect(actionFigure!.text).toContain("*Action Figure* (2)");
    expect(actionFigure!.text).toContain("R$ 29,90");
    expect(actionFigure!.text).toContain(`${SITE}/product/c`);
  });

  it("usa a faixa de preço quando existe", () => {
    const [m] = buildNicheCatalogMessages(
      [product({ priceRange: "16,90 - 32,90", category: "Presentes" })],
      { siteUrl: SITE, brand: "X" },
    );
    expect(m!.text).toContain("R$ 16,90 - 32,90");
  });

  it("peça sem preço fica de fora", () => {
    expect(buildNicheCatalogMessages([product({ price: 0 })], { siteUrl: SITE, brand: "X" })).toEqual([]);
  });
});
