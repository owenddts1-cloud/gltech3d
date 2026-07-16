/**
 * NÃO É MAIS A FONTE DA LANDING. Desde a migration 0041 a landing lê a tabela
 * `products` do Postgres via `lib/landing/repository.ts`, e o Landing Edit
 * escreve nela.
 *
 * Este arquivo sobrevive apenas como semente de `scripts/seed-landing-catalog.ts`
 * (a importação inicial arquivo → banco, já executada). Editar aqui não muda
 * mais nada no site. Pode ser removido depois que o Landing Edit estiver em uso.
 */

export interface ProductLinks {
  shopee?: string;
  mercadoLivre?: string;
  whatsapp?: string;
  instagram?: string;
}

/** Posição no pódio de vendas. 1 = campeão (bloco grande), 2 e 3 = blocos menores. */
export type BestsellerRank = 1 | 2 | 3;

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  priceRange?: string;
  category: string;
  image: string;
  images: string[];
  videos?: string[];
  isTop: boolean;
  /** Preenchido só nos 3 mais vendidos. Governa a seção "Mais Vendidos". */
  bestsellerRank?: BestsellerRank;
  /** Copy longa do bloco campeão (rank 1). Cai para `description` se ausente. */
  heroCopy?: string;
  /**
   * Modelo cadastrado antes da sessão de fotos. A UI mostra um placeholder no
   * lugar da imagem em vez de renderizar `image`. Remover ao subir a foto real.
   */
  pendingPhoto?: boolean;
  material: string;
  dimensions: string;
  colors: string[];
  links: ProductLinks;
}

/** Links de venda padrão da loja. Todo produto compartilha os mesmos canais. */
const STORE_LINKS: ProductLinks = {
  shopee: "https://shopee.com.br/gltech3d",
  mercadoLivre: "https://mercadolivre.com.br",
  whatsapp: "https://wa.me/5531999284834",
  instagram: "https://www.instagram.com/gltech3d/",
};

/** Usado por todo modelo que ainda não tem foto própria da oficina. */
const PHOTO_PENDING_IMAGE = "/images/placeholder-model.svg";

export const products: Product[] = [
  {
    id: "1",
    name: "Luminária Lua Cheia - Alta Qualidade",
    description:
      "Luminária em formato de lua com textura realista, iluminação LED quente e fria, alta qualidade e durabilidade.",
    price: 44.9,
    category: "Luminárias",
    image: "/images/Luminarias/Lua Cheia/luminarialuacheia1.png",
    images: [
      "/images/Luminarias/Lua Cheia/luminarialuacheia1.png",
      "/images/Luminarias/Lua Cheia/luminarialuacheia2.png",
    ],
    isTop: true,
    bestsellerRank: 1,
    heroCopy:
      "A nossa peça campeã de vendas. Cada unidade é fabricada sob demanda utilizando tecnologia de manufatura aditiva de alta definição, reproduzindo com precisão o relevo de crateras e mares lunares. Perfeita para iluminação decorativa e presentes sofisticados.",
    material: "PLA Premium",
    dimensions: "15cm x 15cm",
    colors: ["Branco Frio", "Amarelo Quente"],
    links: STORE_LINKS,
  },
  {
    id: "2",
    name: "Vaso Geométrico Moderno",
    description:
      "Vaso decorativo com design geométrico moderno, ideal para suculentas e plantas pequenas.",
    price: 49.9,
    category: "Decoração",
    image: "/images/Vasos Decoração/Vaso Geometrico Moderno/VasoG1.png",
    images: ["/images/Vasos Decoração/Vaso Geometrico Moderno/VasoG1.png"],
    isTop: false,
    material: "PLA Premium",
    dimensions: "20cm Altura",
    colors: ["Branco", "Preto", "Terracota", "Verde Musgo"],
    links: {
      shopee: "https://shopee.com.br/gltech3d",
      mercadoLivre: "https://mercadolivre.com.br",
      whatsapp: "https://wa.me/5531999284834",
      instagram: "https://www.instagram.com/gltech3d/",
    },
  },
  {
    id: "3",
    name: "Batman - Action Figure",
    description:
      "Action figure articulado com capa removível e base temática de Gotham.",
    price: 74.9,
    category: "Action Figure",
    image: "/images/Action Figure/Batman/Batman.png",
    images: ["/images/Action Figure/Batman/Batman.png"],
    isTop: true,
    material: "PLA Premium",
    dimensions: "15cm Altura",
    colors: ["Branco", "Preto", "Cinza", "Colorido", "Dourado"],
    links: {
      shopee: "https://shopee.com.br/gltech3d",
      mercadoLivre: "https://mercadolivre.com.br",
      whatsapp: "https://wa.me/5531999284834",
      instagram: "https://www.instagram.com/gltech3d/",
    },
  },
  {
    id: "4",
    name: "Kit Vasos Modernos Com Bandeja",
    description:
      "Kit de vasos decorativos modernos acompanhados de bandeja. Perfeito para compor ambientes elegantes.",
    price: 89.9,
    category: "Decoração",
    image:
      "/images/Vasos Decoração/Kit Vasos Modernos Com Bandeja/KitVasosBand1.png",
    images: [
      "/images/Vasos Decoração/Kit Vasos Modernos Com Bandeja/KitVasosBand1.png",
    ],
    isTop: false,
    material: "PLA Premium",
    dimensions: "15cm Altura",
    colors: ["Branco", "Preto", "Terracota"],
    links: {
      shopee: "https://shopee.com.br/gltech3d",
      mercadoLivre: "https://mercadolivre.com.br",
      whatsapp: "https://wa.me/5531999284834",
      instagram: "https://www.instagram.com/gltech3d/",
    },
  },
  {
    id: "5",
    name: "Charizard Articulável",
    description:
      "Charizard articulado com juntas móveis, perfeito para colecionadores e fãs de Pokémon.",
    price: 29.9,
    category: "Action Figure",
    image: "/images/Action Figure/Charizard Articulavel/Charizard1.png",
    images: ["/images/Action Figure/Charizard Articulavel/Charizard1.png"],
    isTop: true,
    bestsellerRank: 2,
    material: "PLA Silk",
    dimensions: "45cm Comprimento",
    colors: ["Multicolorido RGB"],
    links: STORE_LINKS,
  },
  {
    id: "6",
    name: "Páscoa 3D Personalizados Coelhos e Ovos Decorativos",
    description:
      "Decoração de Páscoa 3D Personalizados Coelhos e Ovos Decorativos",
    price: 16.9,
    priceRange: "16,90 - 32,90",
    category: "Presentes",
    image: "/images/Presentes/Pascoa/3A8A51C1-EB72-4F9B-AF5E-79E985A913F7.png",
    images: [
      "/images/Presentes/Pascoa/3A8A51C1-EB72-4F9B-AF5E-79E985A913F7.png",
      "/images/Presentes/Pascoa/43C7ABB7-06F7-4CEA-8EEF-73002DD99369.png",
      "/images/Presentes/Pascoa/90B4DE5B-C363-4814-9F3E-82347FD9253E.png",
      "/images/Presentes/Pascoa/244B01BD-AA42-4680-9ED4-F7647CB2F869.png",
      "/images/Presentes/Pascoa/2185DA4E-3A1B-4223-BE9D-0730141DE4ED.png",
      "/images/Presentes/Pascoa/D5F63162-117C-4A24-BB63-5374C1426C6D.png",
    ],
    videos: [
      "/videos/Presentes/Pascoa/pascoavideo1.mp4",
      "/videos/Presentes/Pascoa/pascoavideo2.mp4",
    ],
    isTop: true,
    material: "PLA Premium",
    dimensions: "17cm Altura",
    colors: ["Colorido", "Marrom", "Branco", "Preto", "Dourado"],
    links: {
      shopee:
        "https://shopee.com.br/Decora%C3%A7%C3%A3o-de-P%C3%A1scoa-3D-Personalizados-Coelhos-e-Ovos-Decorativos-Logo-Personaliz%C3%A1vel-i.438090824.23899360077?xptdk=7a7ca1ab-383e-4132-8bd4-383d5567b024",
      mercadoLivre: "https://mercadolivre.com.br",
      whatsapp: "https://wa.me/5531999284834",
      instagram: "https://www.instagram.com/gltech3d/",
    },
  },
  {
    id: "7",
    name: "Chibi Naruto",
    description:
      "Boneco chibi do Naruto Uzumaki com base personalizada. Super fofo e detalhado!",
    price: 79.9,
    category: "Chibi",
    image: "/images/Chibi/Naruto/Naruto 1.png",
    images: ["/images/Chibi/Naruto/Naruto 1.png", "/images/Chibi/Naruto/Naruto 2.png"],
    isTop: false,
    material: "PLA",
    dimensions: "11cm Altura",
    colors: ["Pintura Realista", "Colorido", "Branco", "Preto"],
    links: {
      shopee: "https://shopee.com.br/gltech3d",
      mercadoLivre: "https://mercadolivre.com.br",
      whatsapp: "https://wa.me/5531999284834",
      instagram: "https://www.instagram.com/gltech3d/",
    },
  },
  {
    id: "8",
    name: "Porta-Celular Astronauta",
    description:
      "Suporte para celular em formato de astronauta. Funcional e decorativo!",
    price: 22.9,
    category: "Utensílios",
    image: "/images/Pota Celular/Astronauta/Astronauta1.png",
    images: ["/images/Pota Celular/Astronauta/Astronauta1.png"],
    isTop: false,
    material: "PLA",
    dimensions: "12cm x 14,6cm x 13,3cm",
    colors: ["Branco", "Preto", "Colorido"],
    links: {
      shopee: "https://shopee.com.br/gltech3d",
      mercadoLivre: "https://mercadolivre.com.br",
      whatsapp: "https://wa.me/5531999284834",
      instagram: "https://www.instagram.com/gltech3d/",
    },
  },
  {
    id: "9",
    name: "Banguela Fúria da Noite - Chaveiro",
    description:
      "Chaveiro do Banguela (Fúria da Noite) do filme Como Treinar o Seu Dragão. Compacto e detalhado!",
    price: 11.9,
    category: "Chaveiros",
    image: "/images/Chaveiros/Banguela Furia da Noite Chaveiro/Banguela 1.png",
    images: [
      "/images/Chaveiros/Banguela Furia da Noite Chaveiro/Banguela 1.png",
    ],
    isTop: true,
    material: "PLA",
    dimensions: "2,5cm x 4,4cm x 1,2cm",
    colors: ["Preto", "Colorido"],
    links: {
      shopee: "https://shopee.com.br/gltech3d",
      mercadoLivre: "https://mercadolivre.com.br",
      whatsapp: "https://wa.me/5531999284834",
      instagram: "https://www.instagram.com/gltech3d/",
    },
  },
  {
    id: "10",
    name: "Base Carregadora Relógio Apple Watch",
    description:
      "Base de carregamento para Apple Watch impressa em 3D. Design moderno e funcional, protótipo exclusivo.",
    price: 59.9,
    category: "Protótipos",
    image:
      "/images/Bases Carregadoras/Base Carregadora Relogio Apple Watch/BaseCApple1.png",
    images: [
      "/images/Bases Carregadoras/Base Carregadora Relogio Apple Watch/BaseCApple1.png",
      "/images/Bases Carregadoras/Base Carregadora Relogio Apple Watch/BaseCApple2.png",
      "/images/Bases Carregadoras/Base Carregadora Relogio Apple Watch/BaseCApple3.png",
    ],
    isTop: true,
    bestsellerRank: 3,
    material: "PLA Premium",
    dimensions: "12,8cm x 12,8cm x 4,2cm",
    colors: ["Branco", "Preto"],
    links: STORE_LINKS,
  },

  // ── Modelos cadastrados aguardando sessão de fotos da oficina ─────────────
  // Preço e dimensões são estimativas de rascunho — revisar antes de publicar.
  {
    id: "11",
    name: "Tralalero Tralalá - Tubarão Articulado",
    description:
      "Tubarão articulado de tênis, o meme que virou febre. Juntas móveis impressas montadas, sai da mesa já articulado.",
    price: 39.9,
    category: "Brinquedos",
    image: PHOTO_PENDING_IMAGE,
    images: [],
    isTop: false,
    pendingPhoto: true,
    material: "PLA Premium",
    dimensions: "Sob consulta",
    colors: ["Cinza", "Azul", "Colorido"],
    links: STORE_LINKS,
  },
  {
    id: "12",
    name: "Tung Tung Tung Sahur - Boneco Articulado",
    description:
      "Boneco articulado do Tung Tung Tung Sahur com braços e pernas móveis, acompanha o bastão. Peça de coleção.",
    price: 34.9,
    category: "Brinquedos",
    image: PHOTO_PENDING_IMAGE,
    images: [],
    isTop: false,
    pendingPhoto: true,
    material: "PLA Premium",
    dimensions: "Sob consulta",
    colors: ["Madeira", "Marrom", "Colorido"],
    links: STORE_LINKS,
  },
  {
    id: "13",
    name: "Porta Canetas Monster - Organizador de Mesa",
    description:
      "Organizador de mesa com recorte vazado e acabamento texturizado. Presença forte em setup gamer ou escritório.",
    price: 39.9,
    category: "Utensílios",
    image: PHOTO_PENDING_IMAGE,
    images: [],
    isTop: false,
    pendingPhoto: true,
    material: "PLA Premium",
    dimensions: "Sob consulta",
    colors: ["Preto Fosco", "Branco", "Verde"],
    links: STORE_LINKS,
  },
  {
    id: "14",
    name: "Suporte de Celular Banguela",
    description:
      "Suporte de celular do Banguela em pose de dragão, com olhos que brilham no escuro. Segura o aparelho na horizontal e na vertical.",
    price: 49.9,
    category: "Utensílios",
    image: PHOTO_PENDING_IMAGE,
    images: [],
    isTop: false,
    pendingPhoto: true,
    material: "PLA Premium",
    dimensions: "Sob consulta",
    colors: ["Preto", "Glow in the Dark"],
    links: STORE_LINKS,
  },
  {
    id: "15",
    name: "Meccha Chameleon - Kit de Poses",
    description:
      "Coleção de bonecos minimalistas em poses variadas. Vende bem em conjunto para compor prateleira ou estante.",
    price: 19.9,
    priceRange: "19,90 - 89,90",
    category: "Decoração",
    image: PHOTO_PENDING_IMAGE,
    images: [],
    isTop: false,
    pendingPhoto: true,
    material: "PLA Premium",
    dimensions: "Sob consulta",
    colors: ["Branco", "Preto", "Colorido"],
    links: STORE_LINKS,
  },
  {
    id: "16",
    name: "Letra Decorada Personalizada",
    description:
      "Letra 3D decorada com o nome da criança, tema à escolha. Peça central de quarto infantil, chá de bebê e festa.",
    price: 54.9,
    category: "Presentes",
    image: PHOTO_PENDING_IMAGE,
    images: [],
    isTop: false,
    pendingPhoto: true,
    material: "PLA Premium",
    dimensions: "Sob consulta",
    colors: ["Personalizado", "Colorido"],
    links: STORE_LINKS,
  },
  {
    id: "17",
    name: "Porta Cartões de Visita - Consultório Odontológico",
    description:
      "Organizador de bancada com porta cartões, dente escultural e suportes para instrumentos. Feito para recepção de consultório.",
    price: 64.9,
    category: "Utensílios",
    image: PHOTO_PENDING_IMAGE,
    images: [],
    isTop: false,
    pendingPhoto: true,
    material: "PLA Premium",
    dimensions: "Sob consulta",
    colors: ["Branco", "Azul"],
    links: STORE_LINKS,
  },
  {
    id: "18",
    name: "Carimbo e Cortador de Biscoito Toy Story",
    description:
      "Kit de cortadores com carimbo em relevo, tema Toy Story. Massa sai marcada e cortada de uma vez. Personalizável com nome.",
    price: 12.9,
    priceRange: "12,90 - 74,90",
    category: "Utensílios",
    image: PHOTO_PENDING_IMAGE,
    images: [],
    isTop: false,
    pendingPhoto: true,
    material: "PLA Premium",
    dimensions: "Sob consulta",
    colors: ["Laranja", "Branco", "Colorido"],
    links: STORE_LINKS,
  },
];

/** Os 3 mais vendidos, ordenados. Fonte única da seção "Mais Vendidos". */
export const bestsellers: Product[] = products
  .filter((p): p is Product & { bestsellerRank: BestsellerRank } => p.bestsellerRank !== undefined)
  .sort((a, b) => a.bestsellerRank - b.bestsellerRank)
  .slice(0, 3);
