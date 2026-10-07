/**
 * Copywriting & Engenharia de Conversão B2B — Catálogo Visual GLTech3D (Agente 3)
 *
 * Textos técnicos de precisão sem clichês generalistas de "IA", voltados a
 * compradores técnicos, engenheiros de produto e diretores industriais.
 */

export interface TechnicalManifesto {
  title: string;
  subtitle: string;
  statement: string;
  standardsNote: string;
}

export const MANUFACTURING_MANIFESTO: TechnicalManifesto = {
  title: "GLTech3D Manufatura Aditiva & Engenharia de Peças",
  subtitle: "Catálogo Técnico de Precisão Industrial // Coleção 2026",
  statement:
    "Peças produzidas em parque fabril climatizado com controle ativo de umidade de filamento, calibração dinâmica de ressonância e repetibilidade milimétrica para lotes prototípicos e finais. Foco absoluto em resistência mecânica, acabamento superficial isotrópico e rigor dimensional.",
  standardsNote:
    "Processos em conformidade com as diretrizes de caracterização dimensional ISO/ASTM 52900 e tolerâncias DIN 16742.",
};

export interface IndustrialCategory {
  id: string;
  code: string;
  title: string;
  description: string;
  idealFor: string;
}

export const INDUSTRIAL_CATEGORIES: IndustrialCategory[] = [
  {
    id: "prototipagem",
    code: "01",
    title: "01. Prototipagem Rápida e Peças Funcionais",
    description: "Modelos conceituais e protótipos de teste de encaixe com rápida iteração e validação de forma.",
    idealFor: "P&D, Validação de Montagem, Encaixes Mecânicos",
  },
  {
    id: "ferramentais",
    code: "02",
    title: "02. Gabaritos, Berços e Ferramentais Industriais",
    description: "Dispositivos de montagem, berços ergonômicos e gabaritos de furação resistentes a desgaste operacional.",
    idealFor: "Linha de Produção, Montagem Industrial, Dispositivos de Fixação",
  },
  {
    id: "polimeros_tecnicos",
    code: "03",
    title: "03. Peças Finais em Polímeros de Engenharia",
    description: "Componentes definitivos impressos em termoplásticos de alto módulo estrutural e estabilidade química.",
    idealFor: "Máquinas, Suportes Automotivos, Dutos e Carcaças Rígidas",
  },
  {
    id: "series_custom",
    code: "04",
    title: "04. Séries Seriadas e Peças Customizadas",
    description: "Produção sob demanda de pequenos e médios lotes sem necessidade de matrizes ou moldes caros de injeção.",
    idealFor: "Reposição Imediata, Lotes Piloto, Customização em Massa",
  },
];

export interface MaterialProperty {
  name: string;
  polymerType: string;
  density: string;
  tensileStrength: string;
  heatDeflectionTemp: string;
  primaryApplication: string;
}

export const MATERIAL_PROPERTIES_TABLE: MaterialProperty[] = [
  {
    name: "PLA Premium HT",
    polymerType: "Poliácido Láctico Modificado",
    density: "1.24 g/cm³",
    tensileStrength: "50 - 60 MPa",
    heatDeflectionTemp: "58°C (HDT B)",
    primaryApplication: "Protótipos visuais, maquetes e peças com alta fidelidade estética.",
  },
  {
    name: "PETG Carbon Fiber",
    polymerType: "PETG + 15% Fibras de Carbono",
    density: "1.30 g/cm³",
    tensileStrength: "65 - 75 MPa",
    heatDeflectionTemp: "78°C (HDT B)",
    primaryApplication: "Suportes mecânicos, berços fabris e peças que exigem rigidez e estabilidade dimensional.",
  },
  {
    name: "TPU 95A Industrial",
    polymerType: "Poliuretano Termoplástico",
    density: "1.21 g/cm³",
    tensileStrength: "35 - 45 MPa (Alongamento > 450%)",
    heatDeflectionTemp: "85°C",
    primaryApplication: "Gaxetas, batentes de impacto, coxins e vedações elásticas.",
  },
  {
    name: "ABS / ASA Pro",
    polymerType: "Acrilonitrila Butadieno Estireno",
    density: "1.06 g/cm³",
    tensileStrength: "40 - 50 MPa",
    heatDeflectionTemp: "96°C (HDT B)",
    primaryApplication: "Invólucros expostos a calor contínuo e peças automotivas com resistência UV.",
  },
  {
    name: "Resina Tough 8K",
    polymerType: "Fotopolímero Acrílico Rígido",
    density: "1.15 g/cm³",
    tensileStrength: "55 - 65 MPa",
    heatDeflectionTemp: "70°C",
    primaryApplication: "Micro-encaixes, roscas finas e modelos com tolerância micrométrica.",
  },
];

export interface B2bQuoteUrlParams {
  phone: string;
  productName: string;
  sku?: string | null;
  pageNumber?: number | null;
  material?: string | null;
  quantity?: number | null;
  customNotes?: string | null;
}

/**
 * Constrói URL direta para o WhatsApp comercial com mensagem formatada para fechamento B2B.
 */
export function buildB2bWhatsappQuoteUrl(params: B2bQuoteUrlParams): string {
  // Higieniza telefone
  let rawDigits = params.phone.replace(/\D/g, "");
  if (rawDigits.length === 10 || rawDigits.length === 11) {
    rawDigits = "55" + rawDigits;
  }
  if (!rawDigits.startsWith("55")) {
    rawDigits = "55" + rawDigits;
  }

  const skuPart = params.sku ? ` (SKU: ${params.sku})` : "";
  const pagePart = params.pageNumber ? ` na pág. ${params.pageNumber}` : "";
  const qtyPart = params.quantity && params.quantity > 1 ? `${params.quantity} unidades` : "1 lote";
  const matPart = params.material ? ` no material ${params.material}` : "";

  const lines = [
    `Olá! Visualizei a peça *${params.productName}*${skuPart}${pagePart} do Catálogo Técnico GLTech3D.`,
    `Gostaria de solicitar uma cotação técnica para ${qtyPart}${matPart}.`,
  ];

  if (params.customNotes) {
    lines.push(`Observação adicional: ${params.customNotes}`);
  }

  lines.push("Origem: Catálogo Digital GLTech3D [Ref: UTM-CATALOG-2026]");

  const fullText = lines.join("\n\n");
  return `https://wa.me/${rawDigits}?text=${encodeURIComponent(fullText)}`;
}
