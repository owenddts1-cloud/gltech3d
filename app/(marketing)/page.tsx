'use client';

import { useState } from 'react';
import Navbar from '@/components/marketing/Navbar';
import HeroScrollVideo from '@/components/marketing/HeroScrollVideo';
import Categories from '@/components/marketing/Categories';
import ProductGrid from '@/components/marketing/ProductGrid';
import HowItWorks from '@/components/marketing/HowItWorks';
import LeadForm from '@/components/marketing/LeadForm';
import NewsletterBar from '@/components/marketing/NewsletterBar';
import Footer from '@/components/marketing/Footer';
import { SmoothScroll } from '@/components/marketing/cinematic/SmoothScroll';

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
        <HowItWorks />
        <LeadForm />
        <NewsletterBar />
        <Footer />
      </main>
    </SmoothScroll>
  );
}
