import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { products, type Product } from '@/lib/marketing/products';

interface ProductGridProps {
  selectedCategory: string;
}

export default function ProductGrid({ selectedCategory }: ProductGridProps) {
  const filteredProducts = products
    .filter((p) => selectedCategory === "" || p.category === selectedCategory)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section id="produtos" className="py-20 px-6 bg-white rounded-t-[3rem]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center mb-12">
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#8E6D4D] uppercase">
            {selectedCategory ? `Categoria: ${selectedCategory}` : "Todos os Produtos"}
          </span>
          <h2 className="text-3xl font-bold mt-2 font-sora mb-4">Nossa Coleção</h2>
          <div className="inline-flex px-4 py-2 rounded-full bg-[#F0EEE9] text-[10px] font-bold text-[#8E6D4D] items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            {filteredProducts.length} {filteredProducts.length === 1 ? 'produto' : 'produtos'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {filteredProducts.map((product: Product) => (
            <Link href={`/product/${product.id}`} key={product.id} className="group flex flex-col items-center text-center">
              <div className="relative w-full rounded-3xl overflow-hidden aspect-square mb-4 bg-[#F9F7F2]">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className="px-2 py-1 rounded-md bg-white/90 text-[8px] font-bold uppercase tracking-wider">
                    {product.category}
                  </span>
                </div>
                {product.isTop && (
                  <div className="absolute top-4 right-4">
                    <span className="px-2 py-1 rounded-md bg-amber-400 text-white text-[8px] font-bold flex items-center gap-1">
                      <Star className="h-2 w-2 fill-current" />
                      TOP
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center justify-center w-full px-2">
                <h3 className="font-bold text-sm mb-1 group-hover:text-[#A6815C] transition-colors">{product.name}</h3>
                <p className="text-xs text-[#6B5E55] line-clamp-2 leading-relaxed mb-3">{product.description}</p>
                <div className="flex items-center justify-between w-full">
                  <span className="text-base font-bold font-sora mx-auto">R$ {product.priceRange ? product.priceRange : product.price.toFixed(2)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
