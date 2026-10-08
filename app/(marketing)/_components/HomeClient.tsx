'use client';

import { useState } from 'react';
import Navbar from '@/components/marketing/Navbar';
import HeroScrollVideo from '@/components/marketing/HeroScrollVideo';
import Categories from '@/components/marketing/Categories';
import ProductGrid from '@/components/marketing/ProductGrid';
import HowItWorks from '@/components/marketing/HowItWorks';
import SocialProof from '@/components/marketing/SocialProof';
import LeadForm from '@/components/marketing/LeadForm';
import NewsletterBar from '@/components/marketing/NewsletterBar';
import Footer from '@/components/marketing/Footer';
import { SmoothScroll } from '@/components/marketing/cinematic/SmoothScroll';
import { SlicerReveal } from '@/components/marketing/cinematic/SlicerReveal';
import { MaterialsParallax } from '@/components/marketing/cinematic/MaterialsParallax';
import FilamentsHomeSection from '@/components/marketing/filaments/FilamentsHomeSection';
import type { LandingCatalog } from '@/lib/landing/types';
import type { PublicFilament } from '@/lib/filament-catalog/types';
import { STORE_WHATSAPP_FALLBACK } from '@/lib/landing/whatsapp-number';

/**
 * Corpo da landing. Recebe o catálogo por prop em vez de importar o módulo:
 * é o que permite ao Live Preview do Landing Edit renderizar ESTES componentes
 * com dados de rascunho, em vez de um mock paralelo que envelhece mal.
 */
export default function HomeClient({
  catalog,
  filaments = [],
  storeWhatsapp = STORE_WHATSAPP_FALLBACK,
}: {
  catalog: LandingCatalog;
  /** Published filaments (empty in the Landing Edit preview = section hidden). */
  filaments?: PublicFilament[];
  storeWhatsapp?: string;
}) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SmoothScroll>
      <main className="min-h-screen">
        <Navbar />
        <HeroScrollVideo settings={catalog.settings} />
        <Categories
          products={catalog.products}
          settings={catalog.settings}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <ProductGrid
          products={catalog.products}
          bestsellers={catalog.bestsellers}
          settings={catalog.settings}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
        />
        <FilamentsHomeSection filaments={filaments} storeWhatsapp={storeWhatsapp} />
        <SlicerReveal />
        <MaterialsParallax />
        <HowItWorks settings={catalog.settings} />
        <SocialProof settings={catalog.settings} />
        <LeadForm settings={catalog.settings} />
        <NewsletterBar settings={catalog.settings} />
        <Footer settings={catalog.settings} />
      </main>
    </SmoothScroll>
  );
}
