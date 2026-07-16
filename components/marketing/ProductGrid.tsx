'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, ArrowUpRight, Flame, Check, HelpCircle, Camera, Trophy } from 'lucide-react';
import type { LandingProduct, LandingSettings } from '@/lib/landing/types';
import { motion } from 'motion/react';
import { TiltCard } from '@/components/marketing/TiltCard';

interface ProductGridProps {
  products: LandingProduct[];
  bestsellers: LandingProduct[];
  settings?: LandingSettings;
  selectedCategory: string;
  searchQuery: string;
}

function formatPrice(product: LandingProduct): string {
  return product.priceRange ? product.priceRange : product.price.toFixed(2);
}

/**
 * Imagem do produto, ou o placeholder da oficina quando a peça foi cadastrada
 * antes da sessão de fotos. Evita renderizar <Image> num arquivo que não existe.
 */
function ProductMedia({
  product,
  className = '',
  sizes,
}: {
  product: LandingProduct;
  className?: string;
  sizes: string;
}) {
  if (product.pendingPhoto) {
    return (
      <div
        role="img"
        aria-label={`${product.name} — foto em produção`}
        className="absolute inset-0 flex items-center justify-center bg-[#F4F1EA] bg-cover bg-center"
        style={{ backgroundImage: `url(${product.image})` }}
      >
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/85 backdrop-blur-sm border border-brand-sand text-[9px] font-extrabold uppercase tracking-wider text-brand-bronze-ink">
          <Camera className="w-3 h-3" />
          Foto em produção
        </span>
      </div>
    );
  }

  return (
    <Image
      src={product.image}
      alt={product.name}
      fill
      className={className}
      referrerPolicy="no-referrer"
      sizes={sizes}
    />
  );
}

/** Bloco grande do campeão de vendas. */
function BestsellerHero({ product }: { product: LandingProduct }) {
  const specs = [
    product.material,
    product.dimensions !== 'Sob consulta' ? product.dimensions : 'Feito sob encomenda',
    `${product.colors.length} ${product.colors.length === 1 ? 'opção de cor' : 'opções de cor'}`,
    'Produção própria',
  ];

  return (
    <motion.div
      whileHover={{ scale: 1.008 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="group relative bg-brand-espresso text-white rounded-[3rem] p-8 md:p-12 shadow-[0_30px_80px_-20px_rgba(43,38,34,0.45)] overflow-hidden flex flex-col lg:flex-row gap-8 lg:gap-12 items-center"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          background:
            'radial-gradient(ellipse at 75% 50%, rgba(166,129,92,0.22) 0%, transparent 65%)',
        }}
        aria-hidden
      />

      <div className="flex-1 z-10 min-w-0">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-bronze/25 border border-brand-bronze/40 text-[9px] font-extrabold text-[#E0C4A0] uppercase tracking-[0.2em] mb-6">
          <Flame className="w-3 h-3 fill-current" />
          Campeão de Vendas
        </span>

        <h4 className="text-3xl md:text-5xl font-black font-sora tracking-[-0.03em] leading-[1.05] mb-5">
          {product.name}
        </h4>

        <p className="text-sm text-stone-300 leading-relaxed mb-8 max-w-lg">
          {product.heroCopy ?? product.description}
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-8 text-[11px] font-bold text-stone-300">
          {specs.map((spec) => (
            <div key={spec} className="flex items-center gap-2">
              <Check className="w-4 h-4 text-brand-bronze shrink-0" />
              <span className="truncate">{spec}</span>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <span className="block text-[9px] font-extrabold text-brand-bronze uppercase tracking-[0.2em] mb-1">
              A partir de
            </span>
            <span className="font-mono text-4xl font-black text-white tracking-tight">
              R$ {formatPrice(product)}
            </span>
          </div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={`/product/${product.slug}`}
              className="bg-brand-bronze hover:bg-[#B8916A] text-white font-extrabold uppercase tracking-[0.15em] text-[11px] py-4 px-8 rounded-2xl inline-flex items-center gap-2 transition-colors duration-300 shadow-lg shadow-brand-bronze/25"
            >
              Encomendar Peça
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </div>

      <div className="w-full lg:w-[26rem] shrink-0 relative aspect-square rounded-[2.5rem] overflow-hidden bg-black/25 z-10">
        <ProductMedia
          product={product}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          sizes="(max-width: 1024px) 100vw, 416px"
        />
      </div>
    </motion.div>
  );
}

/** Blocos 2 e 3 do pódio — menores, claros, para não competir com o campeão. */
function BestsellerRunnerUp({ product, rank }: { product: LandingProduct; rank: number }) {
  return (
    <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
      <Link
        href={`/product/${product.slug}`}
        data-cursor="view"
        data-cursor-text="VER"
        className="group relative flex items-center gap-5 bg-white border border-brand-sand rounded-[2rem] p-4 pr-6 overflow-hidden transition-all duration-400 hover:border-brand-bronze hover:shadow-[0_20px_50px_-15px_rgba(43,38,34,0.22)]"
      >
        {/* Numeral do pódio como elemento gráfico */}
        <span
          className="absolute -right-3 -bottom-8 font-sora font-black text-[7rem] leading-none text-brand-espresso/[0.05] select-none pointer-events-none transition-colors duration-500 group-hover:text-brand-bronze/[0.12]"
          aria-hidden
        >
          {rank}
        </span>

        <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-[1.5rem] overflow-hidden bg-brand-bone">
          <ProductMedia
            product={product}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
            sizes="128px"
          />
        </div>

        <div className="flex-1 min-w-0 z-10">
          <span className="inline-flex items-center gap-1.5 text-[9px] font-extrabold text-brand-bronze-ink uppercase tracking-[0.15em] mb-2">
            <Trophy className="w-3 h-3" />
            {rank}º mais vendido
          </span>
          <h4 className="font-black font-sora text-base text-brand-espresso leading-tight mb-1.5 line-clamp-2 group-hover:text-brand-bronze-deep transition-colors">
            {product.name}
          </h4>
          <p className="text-[11px] text-brand-taupe line-clamp-1 mb-3">{product.category}</p>

          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xl font-black text-brand-espresso tracking-tight">
              R$ {formatPrice(product)}
            </span>
            <span className="w-8 h-8 rounded-full bg-brand-espresso/5 flex items-center justify-center text-brand-espresso group-hover:bg-brand-bronze group-hover:text-white transition-all duration-300 shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function ProductCard({ product, index }: { product: LandingProduct; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.45, delay: Math.min(index, 7) * 0.04 }}
      whileHover={{ scale: 1.025, y: -6 }}
      className="h-full"
    >
      <TiltCard className="h-full" max={5}>
        <Link
          href={`/product/${product.slug}`}
          data-cursor="view"
          data-cursor-text="VER"
          className="group flex flex-col bg-white border border-brand-sand rounded-[2.5rem] p-4 transition-[box-shadow,border-color] duration-500 hover:shadow-[0_28px_70px_-18px_rgba(43,38,34,0.28)] hover:border-brand-bronze h-full justify-between"
        >
          <div>
            <div className="relative w-full rounded-[2rem] overflow-hidden aspect-square mb-5 bg-brand-bone">
              <ProductMedia
                product={product}
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-brand-espresso/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-6 pointer-events-none">
                <span className="text-white text-xs font-bold font-sora flex items-center gap-1.5 translate-y-3 group-hover:translate-y-0 transition-transform duration-500">
                  Ver detalhes <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-[9px] font-extrabold uppercase tracking-wider text-brand-espresso shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-bronze" />
                {product.category}
              </div>

              {product.isTop && (
                <span className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-brand-bronze text-white text-[9px] font-extrabold flex items-center gap-1 shadow-md uppercase tracking-wider">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Destaque
                </span>
              )}
            </div>

            <div className="px-2">
              <h3 className="font-black text-base mb-1.5 text-brand-espresso group-hover:text-brand-bronze-deep transition-colors line-clamp-1 font-sora">
                {product.name}
              </h3>
              <p className="text-xs text-brand-taupe line-clamp-2 leading-relaxed mb-4 min-h-[2.5rem]">
                {product.description}
              </p>
            </div>
          </div>

          <div className="px-2 pt-4 border-t border-brand-sand/70 flex items-center justify-between mt-auto">
            <div className="flex flex-col">
              <span className="text-[9px] font-extrabold text-brand-bronze-ink uppercase tracking-[0.15em] leading-none mb-1">
                Sob Consulta
              </span>
              <span className="text-xs font-semibold text-brand-taupe">
                {product.pendingPhoto ? 'Em breve' : 'Pronto p/ Envio'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black font-mono tracking-tight text-brand-espresso group-hover:text-brand-bronze-deep transition-colors">
                R$ {formatPrice(product)}
              </span>
              <span className="w-8 h-8 rounded-full bg-brand-espresso/5 flex items-center justify-center text-brand-espresso group-hover:bg-brand-bronze group-hover:text-white transition-all duration-300">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </Link>
      </TiltCard>
    </motion.div>
  );
}

export default function ProductGrid({
  products,
  bestsellers,
  settings,
  selectedCategory,
  searchQuery,
}: ProductGridProps) {
  const podiumCopy = settings?.sections?.bestsellers;
  const galleryCopy = settings?.sections?.galeria;
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products
      .filter((p) => {
        const matchesCategory = selectedCategory === '' || p.category === selectedCategory;
        const matchesSearch =
          q === '' ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q);
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, selectedCategory, searchQuery]);

  const [champion, ...runnersUp] = bestsellers;

  // O pódio some quando há filtro ativo — ali o usuário quer o resultado, não a vitrine.
  const showPodium = selectedCategory === '' && searchQuery.trim() === '' && champion;

  return (
    <section
      id="produtos"
      className="py-24 px-6 bg-gradient-to-b from-[#F4F1EA] to-[#FAF9F6] rounded-t-[4rem] relative z-10 border-t border-brand-sand/60"
    >
      <div className="max-w-6xl mx-auto">
        {showPodium && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-24"
          >
            <div className="mb-8">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-brand-bronze-ink font-sora block mb-2">
                {podiumCopy?.eyebrow ?? 'O que mais sai da oficina'}
              </span>
              <h3 className="text-4xl md:text-5xl font-black font-sora text-brand-espresso tracking-[-0.03em]">
                {podiumCopy?.title ?? 'Mais Vendidos'}
              </h3>
            </div>

            <BestsellerHero product={champion} />

            {runnersUp.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                {runnersUp.map((product, i) => (
                  <BestsellerRunnerUp key={product.id} product={product} rank={i + 2} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        <div className="flex flex-col items-center justify-center text-center mb-16">
          <span className="text-[10px] font-extrabold tracking-[0.25em] text-brand-bronze-ink uppercase font-sora">
            {selectedCategory ? `Nicho: ${selectedCategory}` : (galleryCopy?.eyebrow ?? 'Nossa Coleção')}
          </span>
          <h2 className="text-4xl md:text-6xl font-black mt-2 font-sora text-brand-espresso tracking-[-0.03em] mb-5">
            {galleryCopy?.title ?? 'Galeria de Peças'}
          </h2>
          <div className="inline-flex px-4 py-2 rounded-full bg-white border border-brand-sand shadow-sm text-[10px] font-extrabold text-brand-bronze-ink items-center gap-2 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-bronze animate-pulse" />
            {filteredProducts.length} {filteredProducts.length === 1 ? 'modelo 3D' : 'modelos 3D'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {filteredProducts.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-16 bg-white border border-brand-sand rounded-[3rem] px-8 max-w-lg mx-auto">
            <HelpCircle className="w-10 h-10 text-brand-bronze mx-auto mb-3" />
            <p className="text-sm font-black text-brand-ink">Nenhum modelo encontrado</p>
            <p className="text-xs text-brand-taupe mt-1.5 leading-relaxed">
              Experimente buscar por outros termos ou trocar o nicho selecionado.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
