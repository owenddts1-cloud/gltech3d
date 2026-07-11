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

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState('');

  return (
    <SmoothScroll>
      <main className="min-h-screen">
        <Navbar />
        <HeroScrollVideo />
        <Categories
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        <ProductGrid selectedCategory={selectedCategory} />
        <SlicerReveal />
        <MaterialsParallax />
        <HowItWorks />
        <SocialProof />
        <LeadForm />
        <NewsletterBar />
        <Footer />
      </main>
    </SmoothScroll>
  );
}
