'use client';

import { useState } from 'react';
import HeroScrollVideo from '@/components/marketing/HeroScrollVideo';
import MarqueeSection from '@/components/marketing/MarqueeSection';
import AboutSection from '@/components/marketing/AboutSection';
import ServicesSection from '@/components/marketing/ServicesSection';
import Categories from '@/components/marketing/Categories';
import ProductGrid from '@/components/marketing/ProductGrid';
import HowItWorks from '@/components/marketing/HowItWorks';
import SocialProof from '@/components/marketing/SocialProof';
import LeadForm from '@/components/marketing/LeadForm';
import NewsletterBar from '@/components/marketing/NewsletterBar';
import Footer from '@/components/marketing/Footer';
import { SmoothScroll } from '@/components/marketing/cinematic/SmoothScroll';

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState('');

  return (
    <SmoothScroll>
      <main className="min-h-screen">
        <HeroScrollVideo />
        <MarqueeSection />
        <AboutSection />
        <ServicesSection />
        
        <div id="produtos" className="relative z-20">
          <Categories
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          <ProductGrid selectedCategory={selectedCategory} />
        </div>

        <HowItWorks />
        <SocialProof />
        <LeadForm />
        <NewsletterBar />
        <Footer />
      </main>
    </SmoothScroll>
  );
}

