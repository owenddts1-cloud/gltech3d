'use client';

import { useState } from 'react';
import Navbar from '@/components/marketing/Navbar';
import Hero from '@/components/marketing/Hero';
import Categories from '@/components/marketing/Categories';
import ProductGrid from '@/components/marketing/ProductGrid';
import Highlights from '@/components/marketing/Highlights';
import Footer from '@/components/marketing/Footer';

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState('');

  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <Categories
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      <ProductGrid selectedCategory={selectedCategory} />
      <Highlights />
      <Footer />
    </main>
  );
}
