'use client';

import { products } from '@/lib/marketing/products';

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
    <section id="categorias" className="py-20 px-6 max-w-7xl mx-auto">
      <div className="mb-10 text-center">
        <span className="text-[10px] font-bold tracking-[0.2em] text-[#8E6D4D] uppercase">Explorar</span>
        <h2 className="text-3xl font-bold mt-2 font-sora">Categorias</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {categories.map((cat, idx) => {
          const isActive =
            (cat.name === "Todas as Categorias" && selectedCategory === "") ||
            cat.name === selectedCategory;

          return (
            <button
              key={idx}
              onClick={() => handleCategoryClick(cat.name)}
              className={`p-6 rounded-3xl transition-all cursor-pointer group text-left w-full border ${
                isActive
                  ? "bg-[#F0EEE9] border-[#A6815C] shadow-sm"
                  : "bg-[#F0EEE9]/50 border-transparent hover:border-[#A6815C]/50 hover:bg-[#F0EEE9]"
              }`}
            >
              <div className={`text-2xl mb-4 transition-transform origin-left ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {cat.icon}
              </div>
              <span className={`text-xs font-semibold transition-colors ${isActive ? 'text-[#8E6D4D]' : 'text-[#6B5E55]'}`}>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
