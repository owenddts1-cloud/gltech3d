'use client';

import HeroScrollVideo from '@/components/marketing/HeroScrollVideo';
import MarqueeSection from '@/components/marketing/MarqueeSection';
import ServicesSection from '@/components/marketing/ServicesSection';
import ProductGrid from '@/components/marketing/ProductGrid';
import Footer from '@/components/marketing/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F4F1EB] overflow-x-hidden antialiased">
      {/* 1. Hero Clara com Scrubbing do GL Rocket & Navbar Integrado */}
      <HeroScrollVideo />
      
      {/* 2. Marquee Infinito com Itens Reais da GLTech3D */}
      <MarqueeSection />
      
      {/* 3. Lista de Capacidades Técnicas em Impressão 3D */}
      <ServicesSection />
      
      {/* 4. Suas grades originais do site (Categorias, Catálogo e Orçamentos) */}
      <div id="categorias-e-produtos" className="relative z-30">
        <ProductGrid selectedCategory="" />
        <Footer />
      </div>
    </main>
  );
}

