'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, SlidersHorizontal, HelpCircle, ArrowLeft, X, Sparkles } from 'lucide-react';
import type { LandingProduct } from '@/lib/landing/types';
import { ProductCard } from '@/components/marketing/ProductGrid';

interface ProdutosClientProps {
  products: LandingProduct[];
  initialCategory?: string;
}

export function ProdutosClient({ products, initialCategory = '' }: ProdutosClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  // Nichos únicos com suas respectivas contagens
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => {
      const cat = p.category?.trim();
      if (cat) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Filtragem em tempo real
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesCategory = selectedCategory === '' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesQuery =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  const hasActiveFilters = searchQuery.trim() !== '' || selectedCategory !== '';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-brand-ink pt-28 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb e Header */}
        <div className="mb-8">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-brand-taupe mb-4 font-mono">
            <Link href="/" className="hover:text-brand-espresso transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Início
            </Link>
            <span>/</span>
            <span className="text-brand-espresso font-bold">Catálogo de Produtos</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-brand-sand">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-brand-bronze-ink font-sora block mb-2">
                Galeria Completa de Modelos 3D
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-sora text-brand-espresso tracking-tight">
                Todos os Produtos
              </h1>
              <p className="mt-2 text-sm text-brand-taupe max-w-2xl leading-relaxed">
                Explore nosso acervo completo de peças impressas sob demanda com acabamento técnico premium, filamentos de engenharia e precisão industrial.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-brand-sand shadow-sm text-xs font-extrabold text-brand-espresso self-start md:self-auto font-sora">
              <Sparkles className="w-4 h-4 text-brand-bronze animate-pulse" />
              <span>{filteredProducts.length} {filteredProducts.length === 1 ? 'modelo encontrado' : 'modelos encontrados'}</span>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca em Tempo Real */}
        <div className="space-y-4 mb-10">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            {/* Input de busca */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-taupe" />
              <input
                type="text"
                placeholder="Buscar por nome, nicho ou detalhe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3.5 bg-white border border-brand-sand rounded-2xl text-sm font-medium text-brand-espresso placeholder:text-brand-taupe/60 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-bronze/40 focus:border-brand-bronze transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-brand-taupe hover:text-brand-espresso rounded-full hover:bg-brand-sand/50 transition-colors"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-2 text-xs font-extrabold text-brand-bronze-ink hover:text-brand-espresso px-4 py-2 rounded-xl bg-brand-sand/40 hover:bg-brand-sand/70 transition-colors self-start sm:self-auto font-sora"
              >
                <X className="w-3.5 h-3.5" />
                Limpar todos os filtros
              </button>
            )}
          </div>

          {/* Chips de Nichos / Categorias */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-extrabold font-sora transition-all duration-200 border ${
                selectedCategory === ''
                  ? 'bg-brand-espresso text-white border-brand-espresso shadow-md shadow-brand-espresso/15'
                  : 'bg-white text-brand-espresso border-brand-sand hover:border-brand-bronze hover:bg-brand-bone/40'
              }`}
            >
              Todos ({products.length})
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? '' : cat.name)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-extrabold font-sora transition-all duration-200 border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-brand-espresso text-white border-brand-espresso shadow-md shadow-brand-espresso/15'
                      : 'bg-white text-brand-espresso border-brand-sand hover:border-brand-bronze hover:bg-brand-bone/40'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-brand-sand/60 text-brand-taupe'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grade de Produtos */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
            {filteredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white border border-brand-sand rounded-[3rem] px-8 max-w-lg mx-auto shadow-sm">
            <HelpCircle className="w-12 h-12 text-brand-bronze mx-auto mb-4" />
            <h3 className="text-base font-black text-brand-espresso font-sora">Nenhum modelo encontrado</h3>
            <p className="text-xs text-brand-taupe mt-2 leading-relaxed">
              Não encontramos produtos para os critérios de busca selecionados. Experimente limpar os filtros ou buscar por outro termo.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand-espresso text-white text-xs font-extrabold font-sora hover:bg-brand-taupe transition-colors shadow-md"
              >
                Limpar filtros e ver todos
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
