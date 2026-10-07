"use client";

import React, { useState } from "react";
import type { CatalogProductItem } from "@/lib/catalog/whatsapp-formatter";
import {
  type EditorialThemeTokens,
  type CatalogLayoutMode,
  CATALOG_LAYOUT_SPECS,
} from "@/lib/catalog/editorial-design-system";
import { EditorialCard } from "../parts/EditorialCard";
import { partitionProductsForLayout } from "@/lib/catalog/editorial-pdf-engine";
import { Button } from "@/components/ui/button";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";

export interface WebSliderViewProps {
  products: CatalogProductItem[];
  theme: EditorialThemeTokens;
  layoutMode: CatalogLayoutMode;
  priceMode: "varejo" | "atacado" | "sob_consulta";
  wholesaleDiscountPct?: number;
  showDimensions?: boolean;
  showMaterial?: boolean;
  showTolerances?: boolean;
  storeName?: string;
}

export function WebSliderView({
  products,
  theme,
  layoutMode,
  priceMode,
  wholesaleDiscountPct,
  showDimensions,
  showMaterial,
  showTolerances,
  storeName = "GLTECH3D",
}: WebSliderViewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const pages = partitionProductsForLayout(products, layoutMode);
  const totalPages = pages.length;

  const currentProducts = pages[currentPage] || [];
  const spec = CATALOG_LAYOUT_SPECS[layoutMode];

  function handlePrev() {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  }

  function handleNext() {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  }

  return (
    <div
      style={{ backgroundColor: theme.bg, color: theme.fg }}
      className="flex flex-col h-full rounded-2xl border p-4 sm:p-6 transition-colors shadow-inner"
    >
      {/* Barra superior de navegação da apresentação */}
      <div
        style={{ borderColor: theme.border }}
        className="flex items-center justify-between border-b pb-4 mb-4"
      >
        <div>
          <span style={{ color: theme.accent }} className="text-xs font-mono font-bold uppercase tracking-wider">
            {storeName} // Apresentação Digital
          </span>
          <h2 className="text-lg font-bold tracking-tight">
            Coleção Técnica ({products.length} peças selecionadas)
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <span style={{ color: theme.muted }} className="text-xs font-mono font-medium">
            Slide {currentPage + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrev}
              disabled={currentPage === 0}
            >
              <CaretLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleNext}
              disabled={currentPage === totalPages - 1}
            >
              <CaretRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Conteúdo do Slide conforme layout */}
      <div className="flex-1 overflow-y-auto">
        {currentProducts.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-center">
            <p style={{ color: theme.muted }} className="text-sm">
              Nenhum produto selecionado para exibição.
            </p>
          </div>
        ) : layoutMode === "editorial_detail" ? (
          <div className="max-w-2xl mx-auto py-2">
            <EditorialCard
              product={currentProducts[0]!}
              theme={theme}
              layoutMode={layoutMode}
              priceMode={priceMode}
              wholesaleDiscountPct={wholesaleDiscountPct}
              showDimensions={showDimensions}
              showMaterial={showMaterial}
              showTolerances={showTolerances}
            />
          </div>
        ) : layoutMode === "technical_list" ? (
          <div className="flex flex-col gap-3 py-2">
            {currentProducts.map((p) => (
              <EditorialCard
                key={p.id}
                product={p}
                theme={theme}
                layoutMode={layoutMode}
                priceMode={priceMode}
                wholesaleDiscountPct={wholesaleDiscountPct}
                showDimensions={showDimensions}
                showMaterial={showMaterial}
                showTolerances={showTolerances}
              />
            ))}
          </div>
        ) : (
          <div
            className={`grid gap-4 py-2 ${
              layoutMode === "hero_plus_3"
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1 sm:grid-cols-2"
            }`}
          >
            {currentProducts.map((p) => (
              <EditorialCard
                key={p.id}
                product={p}
                theme={theme}
                layoutMode={layoutMode}
                priceMode={priceMode}
                wholesaleDiscountPct={wholesaleDiscountPct}
                showDimensions={showDimensions}
                showMaterial={showMaterial}
                showTolerances={showTolerances}
              />
            ))}
          </div>
        )}
      </div>

      {/* Indicador de pontos na base */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-4 mt-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentPage(i)}
              style={{
                backgroundColor: i === currentPage ? theme.accent : theme.border,
              }}
              className="h-1.5 rounded-full transition-all duration-200"
              style-width={i === currentPage ? "24px" : "6px"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
