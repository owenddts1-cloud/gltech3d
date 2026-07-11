'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Star, ArrowUpRight } from 'lucide-react';
import { products, type Product } from '@/lib/marketing/products';
import { motion } from 'motion/react';
import { TiltCard } from '@/components/marketing/TiltCard';

interface ProductGridProps {
  selectedCategory: string;
}

export default function ProductGrid({ selectedCategory }: ProductGridProps) {
  const filteredProducts = products
    .filter((p) => selectedCategory === "" || p.category === selectedCategory)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section id="produtos" className="py-24 px-6 bg-[#E5E5E5]/20 rounded-t-[4rem] relative z-10 border-t border-neutral-200/30">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center mb-16">
          <span className="text-[10px] font-bold tracking-[0.25em] text-[#8E6D4D] uppercase font-sora">
            {selectedCategory ? `Categoria: ${selectedCategory}` : "Coleção Premium"}
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold mt-2 font-sora text-[#2B2622] mb-4">Nossa Coleção</h2>
          <div className="inline-flex px-4 py-2 rounded-full bg-white border border-neutral-200/50 shadow-sm text-[10px] font-bold text-[#8E6D4D] items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            {filteredProducts.length} {filteredProducts.length === 1 ? 'modelo 3D' : 'modelos 3D'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {filteredProducts.map((product: Product, index: number) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="h-full"
            >
              <TiltCard className="h-full">
              <Link
                href={`/product/${product.id}`}
                data-cursor="view"
                data-cursor-text="VER"
                className="group flex flex-col bg-white/35 backdrop-blur-xl border border-white/50 rounded-[2.5rem] p-4 transition-all duration-500 hover:shadow-[0_25px_60px_rgba(43,38,34,0.06)] hover:bg-white/80 hover:border-[#A6815C]/40 h-full justify-between"
              >
                <div>
                  {/* Image Container */}
                  <div className="relative w-full rounded-[2rem] overflow-hidden aspect-square mb-5 bg-[#F9F7F2]">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      referrerPolicy="no-referrer"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                    
                    {/* Hover Image Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-6">
                      <span className="text-white text-xs font-bold font-sora flex items-center gap-1.5 translate-y-3 group-hover:translate-y-0 transition-transform duration-500">
                        Ver detalhes <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </div>

                    {/* Status Dot / Category Tag — descola para cima/esquerda no hover */}
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-neutral-200/10 text-[9px] font-bold uppercase tracking-wider text-[#2B2622] shadow-sm transition-transform duration-500 ease-out will-change-transform group-hover:-translate-x-1 group-hover:-translate-y-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                      {product.category}
                    </div>

                    {/* Top rating badge */}
                    {product.isTop && (
                      <div className="absolute top-4 right-4">
                        <span className="px-3 py-1.5 rounded-full bg-[#A6815C] text-white text-[9px] font-extrabold flex items-center gap-1 shadow-md border border-white/10 uppercase tracking-wider">
                          <Star className="h-2.5 w-2.5 fill-current text-white" style={{ animation: 'spin 8s linear infinite' }} />
                          Destaque
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Text details */}
                  <div className="px-2">
                    <h3 className="font-extrabold text-base mb-1.5 text-[#2B2622] group-hover:text-[#A6815C] transition-colors line-clamp-1 font-sora">
                      {product.name}
                    </h3>
                    <p className="text-xs text-[#6B5E55] line-clamp-2 leading-relaxed mb-4 min-h-[2.5rem]">
                      {product.description}
                    </p>
                  </div>
                </div>

                {/* Footer of the card */}
                <div className="px-2 pt-4 border-t border-neutral-200/50 flex items-center justify-between mt-auto">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-[#8E6D4D] uppercase tracking-widest leading-none mb-1">
                      Sob Consulta
                    </span>
                    <span className="text-xs font-semibold text-neutral-400">
                      Pronto p/ Envio
                    </span>
                  </div>
                  <div className="flex items-center gap-2 transition-transform duration-500 ease-out will-change-transform group-hover:translate-x-1 group-hover:translate-y-1">
                    <span className="text-lg font-bold font-mono tracking-tight text-[#2B2622] group-hover:text-[#A6815C] transition-colors">
                      R$ {product.priceRange ? product.priceRange : product.price.toFixed(2)}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-[#2B2622]/5 border border-[#2B2622]/5 flex items-center justify-center text-[#2B2622] group-hover:bg-[#A6815C] group-hover:border-[#A6815C] group-hover:text-white transition-all duration-300">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Link>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
