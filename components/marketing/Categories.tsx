'use client';

import { products } from '@/lib/marketing/products';
import { motion } from 'motion/react';
import { TiltCard } from '@/components/marketing/TiltCard';

// Mapeamento de ícones por nome de categoria
const categoryIcons: Record<string, string> = {
  "Brinquedos": "🧸",
  "Decoração": "🏠",
  "Luminárias": "💡",
  "Action Figure": "⚔️",
  "Chibi": "🗿",
  "Cartoon": "🎨",
  "Anime": "✨",
  "Utensílios": "🌱",
  "Presentes": "🎁",
  "Protótipos": "⚙️",
  "Chaveiros": "🔑",
};

const defaultIcon = "📦";

interface CategoriesProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export default function Categories({ selectedCategory, onSelectCategory }: CategoriesProps) {
  // Categorias dos produtos + categorias registradas no mapa de ícones
  const productCategories = Array.from(new Set(products.map((p) => p.category)));
  const allCategoryNames = Array.from(new Set([...productCategories, ...Object.keys(categoryIcons)]));

  const categories = [
    { icon: "🎨", name: "Todas as Categorias" },
    ...allCategoryNames.map((name) => ({
      icon: categoryIcons[name] || defaultIcon,
      name,
    })),
  ];

  const handleCategoryClick = (categoryName: string) => {
    const value = categoryName === "Todas as Categorias" ? "" : categoryName;
    onSelectCategory(value);
    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="categorias" className="py-20 px-6 max-w-7xl mx-auto relative z-10">
      <div className="mb-16 text-center">
        <div className="inline-flex px-3 py-1.5 rounded-full bg-[#A6815C]/10 border border-[#A6815C]/20 text-[9px] font-extrabold text-[#8E6D4D] uppercase tracking-[0.25em] mb-4">
          Explorar Catálogo
        </div>
        <h2 className="text-3xl md:text-5xl font-black mt-2 font-sora text-[#2B2622] tracking-tight">
          Navegar por Categoria
        </h2>
        <p className="text-xs md:text-sm text-[#6B5E55] mt-3 max-w-md mx-auto leading-relaxed font-medium">
          Filtre os modelos 3D ativos e consulte especificações, pesos e compatibilidade de manufatura.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
        {categories.map((cat, idx) => {
          const isActive =
            (cat.name === "Todas as Categorias" && selectedCategory === "") ||
            cat.name === selectedCategory;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: idx * 0.04 }}
              className="h-full"
            >
              <TiltCard max={5}>
                <motion.button
                  onClick={() => handleCategoryClick(cat.name)}
                  data-cursor="explore"
                  data-cursor-text="FILTRAR"
                  whileHover={{ y: -6, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative p-5 rounded-[2.25rem] transition-all cursor-pointer group text-left w-full border flex flex-col justify-between aspect-[1.05] overflow-hidden ${
                    isActive
                      ? "bg-[#2B2622] border-[#2B2622] text-white shadow-xl shadow-[#2B2622]/20"
                      : "bg-white/40 backdrop-blur-xl border-white/60 hover:border-[#A6815C]/40 hover:bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.015)]"
                  }`}
                  style={{
                    transition: 'background-color 0.25s, border-color 0.25s, color 0.25s, box-shadow 0.25s',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Glow decorativo de fundo para cards ativos */}
                  {isActive && (
                    <div className="absolute top-0 right-0 w-16 h-16 bg-[#A6815C]/20 rounded-full blur-xl pointer-events-none" />
                  )}

                  {/* Indicador de status/ativo no topo superior direito */}
                  {isActive && (
                    <div className="absolute top-4 right-4 flex items-center justify-center">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A6815C] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#A6815C]"></span>
                      </span>
                    </div>
                  )}

                  {/* Moldura táctil para o emoji/ícone — salta em parallax (translateZ) no tilt */}
                  <div
                    className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-2xl transition-all duration-300 ${
                      isActive
                        ? "bg-white/10 border border-white/10 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)]"
                        : "bg-[#2B2622]/5 border border-[#2B2622]/5 shadow-sm group-hover:bg-[#A6815C]/10 group-hover:border-[#A6815C]/20"
                    }`}
                    style={{ transform: 'translateZ(38px)' }}
                  >
                    <div className="group-hover:animate-bounce-subtle transition-transform duration-300">
                      {cat.icon}
                    </div>
                  </div>

                  <span
                    className={`text-[13px] font-extrabold tracking-wide transition-colors mt-4 block ${
                      isActive ? 'text-white' : 'text-[#6B5E55] group-hover:text-[#2B2622]'
                    }`}
                    style={{ transform: 'translateZ(16px)' }}
                  >
                    {cat.name}
                  </span>
                </motion.button>
              </TiltCard>
            </motion.div>
          );
        })}
      </div>
      
      <style jsx global>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(-5deg); }
        }
        .group:hover .group-hover\:animate-bounce-subtle {
          animation: bounce-subtle 0.6s ease-in-out;
        }
      `}</style>
    </section>
  );
}
