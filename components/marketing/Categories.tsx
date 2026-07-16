'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  Search,
  ChevronDown,
  Sparkles,
  Lightbulb,
  Home,
  Sword,
  Gift,
  Palette,
  Wrench,
  Key,
  Settings,
  Gamepad2,
  X,
  Boxes,
  Compass,
  CornerDownLeft,
  type LucideIcon,
} from 'lucide-react';
import type { LandingProduct, LandingSettings } from '@/lib/landing/types';

const categoryIcons: Record<string, LucideIcon> = {
  Brinquedos: Gamepad2,
  Decoração: Home,
  Luminárias: Lightbulb,
  'Action Figure': Sword,
  Chibi: Compass,
  Cartoon: Palette,
  Anime: Sparkles,
  Utensílios: Wrench,
  Presentes: Gift,
  Protótipos: Settings,
  Chaveiros: Key,
};

const ALL_CATEGORIES = 'Todas as Categorias';
const MAX_SUGGESTIONS = 5;

interface CategoriesProps {
  products: LandingProduct[];
  settings?: LandingSettings;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function Categories({
  products,
  settings,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
}: CategoriesProps) {
  const copy = settings?.sections?.categorias;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  // "/" foca a busca de qualquer lugar da página — atalho de e-commerce padrão.
  useHotkeys(
    '/',
    (event) => {
      event.preventDefault();
      inputRef.current?.focus();
    },
    { enableOnFormTags: false },
  );

  // Só nichos que realmente têm peça no catálogo. Categoria vazia é ruído.
  const categories = useMemo(() => {
    const withCount = Array.from(new Set(products.map((p) => p.category)))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        icon: categoryIcons[name] ?? Boxes,
        count: products.filter((p) => p.category === name).length,
      }));
    return [{ name: ALL_CATEGORIES, icon: Boxes, count: products.length }, ...withCount];
  }, [products]);

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [products, searchQuery]);

  const resultCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory = selectedCategory === '' || p.category === selectedCategory;
      const matchesSearch =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    }).length;
  }, [products, searchQuery, selectedCategory]);

  const showSuggestions = isFocused && suggestions.length > 0;

  function handleCategorySelect(categoryName: string) {
    onSelectCategory(categoryName === ALL_CATEGORIES ? '' : categoryName);
    setIsDropdownOpen(false);
  }

  function commitSuggestion(name: string) {
    onSearchChange(name);
    setActiveSuggestion(-1);
    setIsFocused(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      inputRef.current?.blur();
      setActiveSuggestion(-1);
      return;
    }
    if (!showSuggestions) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      const picked = suggestions[activeSuggestion];
      if (picked) commitSuggestion(picked.name);
    }
  }

  const ActiveIcon = selectedCategory ? categoryIcons[selectedCategory] ?? Boxes : Boxes;
  const isFiltering = searchQuery.trim() !== '' || selectedCategory !== '';

  return (
    // z-30: acima de #produtos (z-10), senão a seção seguinte corta as sugestões
    // e o dropdown de nicho. Abaixo da navbar (z-50).
    <section id="categorias" className="py-20 px-6 max-w-5xl mx-auto relative z-30">
      <div className="mb-10 text-center">
        <div className="inline-flex px-3.5 py-1.5 rounded-full bg-brand-bronze/10 border border-brand-bronze/25 text-[10px] font-extrabold text-brand-bronze-ink uppercase tracking-[0.25em] mb-5">
          {copy?.eyebrow ?? 'Navegar Catálogo'}
        </div>
        <h2 className="text-4xl md:text-6xl font-black font-sora text-brand-espresso tracking-[-0.03em]">
          {copy?.title ?? 'Navegar por Nichos'}
        </h2>
        <p className="text-sm text-brand-taupe mt-4 max-w-sm mx-auto leading-relaxed">
          {copy?.subtitle ?? 'Busque pelo nome da peça ou filtre pelo nicho.'}
        </p>
      </div>

      {/* Busca — elemento dominante. Filtro de nicho fica secundário ao lado. */}
      <div className="relative max-w-3xl mx-auto">
        <motion.div
          animate={{
            borderColor: isFocused ? '#A6815C' : '#D5CBBF',
            boxShadow: isFocused
              ? '0 18px 50px -12px rgba(43,38,34,0.16)'
              : '0 2px 10px -4px rgba(43,38,34,0.06)',
          }}
          transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
          className="relative flex flex-col sm:flex-row items-stretch gap-2 bg-white border rounded-3xl p-2"
        >
          <div className="relative flex-1 flex items-center">
            <motion.span
              animate={{ scale: isFocused && !reduceMotion ? 1.12 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              className="absolute left-4 pointer-events-none"
            >
              <Search
                className={`w-[18px] h-[18px] transition-colors duration-300 ${
                  isFocused ? 'text-brand-bronze' : 'text-brand-taupe'
                }`}
              />
            </motion.span>

            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setActiveSuggestion(-1);
              }}
              onFocus={() => setIsFocused(true)}
              // Timeout deixa o clique na sugestão registrar antes do blur fechar a lista.
              onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar por nome do modelo ou nicho..."
              aria-label="Buscar modelos 3D"
              className="w-full pl-12 pr-24 py-4 bg-transparent text-sm text-brand-ink placeholder-brand-taupe/70 outline-none font-medium"
            />

            <div className="absolute right-3 flex items-center gap-2">
              <AnimatePresence mode="wait">
                {searchQuery ? (
                  <motion.button
                    key="clear"
                    type="button"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => {
                      onSearchChange('');
                      inputRef.current?.focus();
                    }}
                    aria-label="Limpar busca"
                    className="p-1.5 rounded-full text-brand-taupe hover:text-brand-ink hover:bg-brand-bone transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                ) : (
                  <motion.kbd
                    key="hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hidden sm:block px-2 py-1 rounded-md border border-brand-sand bg-brand-bone text-[10px] font-bold text-brand-taupe font-mono"
                  >
                    /
                  </motion.kbd>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="hidden sm:block w-px bg-brand-sand/70 my-2" />

          {/* Seletor de nicho */}
          <div className="relative sm:w-60 shrink-0">
            <button
              type="button"
              onClick={() => setIsDropdownOpen((v) => !v)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
              className="w-full h-full flex items-center justify-between gap-2 px-4 py-3.5 rounded-2xl text-sm font-bold text-brand-ink hover:bg-brand-bone transition-colors duration-200"
            >
              <span className="flex items-center gap-2.5 truncate">
                <ActiveIcon className="w-4 h-4 text-brand-bronze shrink-0" />
                <span className="truncate">{selectedCategory || 'Todos os nichos'}</span>
              </span>
              <motion.span
                animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
                className="shrink-0"
              >
                <ChevronDown className="w-4 h-4 text-brand-taupe" />
              </motion.span>
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsDropdownOpen(false)}
                    aria-hidden
                  />
                  <motion.ul
                    role="listbox"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
                    className="absolute left-0 right-0 top-full mt-3 bg-white border border-brand-sand rounded-2xl shadow-xl z-30 max-h-72 overflow-y-auto p-1.5"
                  >
                    {categories.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected =
                        cat.name === ALL_CATEGORIES
                          ? selectedCategory === ''
                          : cat.name === selectedCategory;

                      return (
                        <li key={cat.name} role="option" aria-selected={isSelected}>
                          <button
                            type="button"
                            onClick={() => handleCategorySelect(cat.name)}
                            className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left text-[13px] transition-colors ${
                              isSelected
                                ? 'bg-brand-espresso text-white font-bold'
                                : 'text-brand-taupe hover:bg-brand-bone hover:text-brand-ink font-medium'
                            }`}
                          >
                            <span className="flex items-center gap-2.5 truncate">
                              <Icon
                                className={`w-4 h-4 shrink-0 ${
                                  isSelected ? 'text-white' : 'text-brand-bronze'
                                }`}
                              />
                              <span className="truncate">{cat.name}</span>
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold shrink-0 ${
                                isSelected ? 'text-white/60' : 'text-brand-taupe/60'
                              }`}
                            >
                              {cat.count}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </motion.ul>
                </>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Sugestões conforme digita */}
        <AnimatePresence>
          {showSuggestions && (
            <motion.ul
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
              className="absolute left-0 right-0 sm:right-[15.5rem] top-full mt-3 bg-white border border-brand-sand rounded-2xl shadow-xl z-30 p-1.5 overflow-hidden"
            >
              {suggestions.map((p, i) => {
                const Icon = categoryIcons[p.category] ?? Boxes;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveSuggestion(i)}
                      onClick={() => commitSuggestion(p.name)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        i === activeSuggestion ? 'bg-brand-bone' : ''
                      }`}
                    >
                      <Icon className="w-4 h-4 text-brand-bronze shrink-0" />
                      <span className="flex-1 truncate text-[13px] font-semibold text-brand-ink">
                        {p.name}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-taupe shrink-0">
                        {p.category}
                      </span>
                      {i === activeSuggestion && (
                        <CornerDownLeft className="w-3.5 h-3.5 text-brand-taupe shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Estado do filtro */}
      <AnimatePresence>
        {isFiltering && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-center gap-3 pt-6 text-xs">
              <span className="font-bold text-brand-espresso">
                {resultCount} {resultCount === 1 ? 'peça encontrada' : 'peças encontradas'}
              </span>
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  onSelectCategory('');
                }}
                className="font-bold text-brand-bronze-ink underline underline-offset-4 hover:text-brand-espresso transition-colors"
              >
                Limpar filtros
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
