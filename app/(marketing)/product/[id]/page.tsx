import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Box, Ruler } from 'lucide-react';
import { getLandingCatalog } from '@/lib/landing/repository';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import ProductGallery from '@/components/marketing/ProductGallery';
import ProductActions from './ProductActions';
import VariationPicker from './VariationPicker';

// O parâmetro chama-se `id` por herança da rota, mas hoje carrega o slug.
// Aceitamos os dois: links antigos com uuid continuam abrindo.
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { products } = await getLandingCatalog();
  const product = products.find((p) => p.slug === id) ?? products.find((p) => p.id === id);

  if (!product) {
    notFound();
  }

  const relatedProducts = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <main className="min-h-screen pt-24 bg-[#F9F7F2]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <ProductGallery
            images={product.images.length > 0 ? product.images : [product.image]}
            productName={product.name}
            videos={product.videos}
          />

          {/* Details */}
          <div className="flex flex-col justify-center">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 rounded-full bg-[#E8E2D9] text-[10px] font-bold text-[#8E6D4D] uppercase tracking-wider mb-4">
                {product.category}
              </span>
              <h1 className="text-4xl font-bold font-sora mb-4">{product.name}</h1>
              <p className="text-[#6B5E55] leading-relaxed">{product.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-white border border-[#E8E2D9]">
                <Box className="w-5 h-5 text-[#A6815C] mb-2" />
                <div className="text-[10px] text-[#6B5E55] uppercase tracking-wider font-bold mb-1">Material</div>
                <div className="font-semibold text-sm">{product.material}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-[#E8E2D9]">
                <Ruler className="w-5 h-5 text-[#A6815C] mb-2" />
                <div className="text-[10px] text-[#6B5E55] uppercase tracking-wider font-bold mb-1">Dimensões</div>
                <div className="font-semibold text-sm">{product.dimensions}</div>
              </div>
            </div>

            <div className="mb-8 space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-[#E8E2D9]">
                <div className="text-[10px] text-[#6B5E55] uppercase tracking-wider font-bold mb-3">Cores Disponíveis</div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <span key={color} className="px-3 py-1.5 rounded-lg border border-[#E8E2D9] text-xs font-medium">
                      {color}
                    </span>
                  ))}
                </div>
              </div>

              {product.variations.length > 0 && <VariationPicker groups={product.variations} />}
            </div>

            <ProductActions product={product} />
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-24">
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8E6D4D] uppercase">Mesma Categoria</span>
            <h2 className="text-2xl font-bold mt-2 font-sora mb-8">Você também vai gostar</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {relatedProducts.map((p) => (
                <Link href={`/product/${p.slug}`} key={p.id} className="group block">
                  <div className="relative rounded-3xl overflow-hidden aspect-square mb-4 bg-white">
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <h3 className="font-bold text-sm mb-1 group-hover:text-[#A6815C] transition-colors">{p.name}</h3>
                  <span className="text-base font-bold font-sora">R$ {p.priceRange ? p.priceRange : p.price.toFixed(2)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
