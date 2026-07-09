/**
 * Catálogo estático da landing GLTech3D (storefront público).
 * Fonte de exibição apenas — o CRM/pipeline é a fonte de verdade operacional.
 * Ported de _landing-original/lib/data.ts, agora tipado (CLAUDE.md: sem `any`).
 */

export interface ProductLinks {
  shopee?: string;
  mercadoLivre?: string;
  whatsapp?: string;
  instagram?: string;
}

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
  material: string;
  dimensions: string;
  colors: string[];
  links: ProductLinks;
}

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
    material: "PLA Premium",
    dimensions: "15cm x 15cm",
    colors: ["Branco Frio", "Amarelo Quente"],
    links: {
      shopee: "https://shopee.com.br/gltech3d",
      mercadoLivre: "https://mercadolivre.com.br",
      whatsapp: "https://wa.me/5531999284834",
      instagram: "https://www.instagram.com/gltech3d/",
    },
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
    material: "PLA Silk",
    dimensions: "45cm Comprimento",
    colors: ["Multicolorido RGB"],
    links: {
      shopee: "https://shopee.com.br/gltech3d",
      mercadoLivre: "https://mercadolivre.com.br",
      whatsapp: "https://wa.me/5531999284834",
      instagram: "https://www.instagram.com/gltech3d/",
    },
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
    material: "PLA Premium",
    dimensions: "12,8cm x 12,8cm x 4,2cm",
    colors: ["Branco", "Preto"],
    links: {
      shopee: "https://shopee.com.br/gltech3d",
      mercadoLivre: "https://mercadolivre.com.br",
      whatsapp: "https://wa.me/5531999284834",
      instagram: "https://www.instagram.com/gltech3d/",
    },
  },
];
