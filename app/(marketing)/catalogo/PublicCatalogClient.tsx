"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { WhatsappLogo, ArrowUpRight, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";

import type { LandingCatalog, LandingProduct } from "@/lib/landing/types";

export function PublicCatalogClient({ catalog }: { catalog: LandingCatalog }) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("todas");

  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [catalog.products]);

  const filteredProducts = useMemo(() => {
    return catalog.products.filter((p) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const mName = p.name.toLowerCase().includes(q);
        const mCat = p.category?.toLowerCase().includes(q);
        if (!mName && !mCat) return false;
      }
      if (selectedCategory !== "todas" && p.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [catalog.products, search, selectedCategory]);

  return (
    <div className="space-y-8">
      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="relative w-full sm:w-80">
          <MagnifyingGlass className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar peça no catálogo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedCategory("todas")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === "todas"
                  ? "bg-amber-400 text-slate-950"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              Todas
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-amber-400 text-slate-950"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid de Produtos */}
      {filteredProducts.length === 0 ? (
        <div className="py-20 text-center text-slate-500">
          <p className="text-sm">Nenhuma peça encontrada para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((p) => {
            const priceStr = p.price.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });
            const waMsg = encodeURIComponent(
              `Olá! Vi o produto *${p.name}* no catálogo da GLTECH3D e gostaria de fazer um pedido.`,
            );

            return (
              <div
                key={p.id}
                className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-amber-400/50 transition-all hover:shadow-lg hover:shadow-amber-500/5"
              >
                <div>
                  {/* Foto principal */}
                  <div className="aspect-square w-full rounded-lg bg-slate-950 border border-slate-800 overflow-hidden mb-4 relative">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-700">
                        <Sparkle className="h-8 w-8" />
                      </div>
                    )}
                    {p.bestsellerRank && (
                      <span className="absolute top-2 right-2 rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow">
                        ★ MAIS VENDIDO
                      </span>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-sm text-slate-100 group-hover:text-amber-400 transition-colors">
                      {p.name}
                    </h3>
                  </div>

                  {p.heroCopy && (
                    <p className="text-xs italic text-slate-400 mb-3 line-clamp-2">{p.heroCopy}</p>
                  )}

                  <div className="space-y-1 text-xs text-slate-400 mb-4">
                    {p.material && <div>🧱 Material: {p.material}</div>}
                    {p.dimensions && <div>📏 Dimensões: {p.dimensions}</div>}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-base font-bold text-amber-400">{priceStr}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {p.slug && (
                      <Link
                        href={`/product/${p.slug}`}
                        className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-amber-400 hover:text-amber-400 transition-colors"
                        title="Ver Detalhes"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    )}
                    <a
                      href={`https://wa.me/5531999284834?text=${waMsg}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500 transition-colors"
                    >
                      <WhatsappLogo className="h-4 w-4" />
                      Pedir
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
