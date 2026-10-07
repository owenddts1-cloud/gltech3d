"use client";

import React, { useState } from "react";
import type { CatalogProductItem } from "@/lib/catalog/whatsapp-formatter";
import {
  type EditorialThemeTokens,
  type CatalogLayoutMode,
  TECHNICAL_BADGES,
} from "@/lib/catalog/editorial-design-system";
import { EditorialCard } from "../parts/EditorialCard";
import { partitionProductsForLayout } from "@/lib/catalog/editorial-pdf-engine";
import { formatWhatsappDisplay } from "@/lib/landing/whatsapp-number";
import { Button } from "@/components/ui/button";
import { CaretLeft, CaretRight, MagnifyingGlassPlus, MagnifyingGlassMinus } from "@phosphor-icons/react/dist/ssr";

export interface A4PrintSheetViewProps {
  products: CatalogProductItem[];
  theme: EditorialThemeTokens;
  layoutMode: CatalogLayoutMode;
  priceMode: "varejo" | "atacado" | "sob_consulta";
  wholesaleDiscountPct?: number;
  showDimensions?: boolean;
  showMaterial?: boolean;
  showTolerances?: boolean;
  storeName?: string;
  contactPhone?: string;
}

export function A4PrintSheetView({
  products,
  theme,
  layoutMode,
  priceMode,
  wholesaleDiscountPct,
  showDimensions,
  showMaterial,
  showTolerances,
  storeName = "GLTECH3D",
  contactPhone = "11988887777",
}: A4PrintSheetViewProps) {
  const [activeSheet, setActiveSheet] = useState(0);
  const [zoom, setZoom] = useState(1);
  const pages = partitionProductsForLayout(products, layoutMode);
  const totalSheets = pages.length;

  const currentProducts = pages[activeSheet] || [];

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Barra de controle de página A4 e Zoom */}
      <div className="flex items-center justify-between rounded-xl border bg-surface p-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-foreground">Folha de Impressão A4</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-muted-foreground">
            Página {activeSheet + 1} de {totalSheets}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Controles de Zoom */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom((z) => Math.max(0.75, z - 0.1))}
            >
              <MagnifyingGlassMinus className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] font-mono text-muted-foreground w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom((z) => Math.min(1.25, z + 0.1))}
            >
              <MagnifyingGlassPlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Navegação entre folhas */}
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setActiveSheet((s) => Math.max(0, s - 1))}
            disabled={activeSheet === 0}
          >
            <CaretLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setActiveSheet((s) => Math.min(totalSheets - 1, s + 1))}
            disabled={activeSheet === totalSheets - 1}
          >
            <CaretRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Container com scroll da folha física A4 */}
      <div className="flex-1 overflow-auto rounded-2xl bg-muted/30 p-4 sm:p-8 flex items-center justify-center">
        <div
          style={{
            backgroundColor: theme.bg,
            color: theme.fg,
            borderColor: theme.border,
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            width: "595px", // Proporção A4 (210 x 297 mm em escala 72dpi padrão)
            minHeight: "842px",
          }}
          className="relative flex flex-col justify-between rounded shadow-2xl border p-8 transition-transform duration-150"
        >
          {/* Header A4 Editorial */}
          <div
            style={{ borderColor: theme.border }}
            className="flex items-center justify-between border-b pb-2 text-[10px]"
          >
            <span style={{ color: theme.muted }} className="font-bold tracking-wider">
              {storeName.toUpperCase()}
            </span>
            <span style={{ color: theme.muted }} className="uppercase">
              Catálogo Técnico // A4 Gráfico
            </span>
            <span style={{ color: theme.muted }} className="font-mono">
              Pág. {activeSheet + 1} / {totalSheets}
            </span>
          </div>

          {/* Conteúdo do Miolo A4 */}
          <div className="flex-1 py-4">
            {currentProducts.length === 0 ? (
              <div className="flex h-96 items-center justify-center text-center">
                <p style={{ color: theme.muted }} className="text-xs">
                  Nenhum produto nesta folha.
                </p>
              </div>
            ) : layoutMode === "editorial_detail" ? (
              <div className="flex h-full items-center justify-center">
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
            ) : (
              <div
                className={`grid gap-3 ${
                  layoutMode === "hero_plus_3"
                    ? "grid-cols-2"
                    : layoutMode === "technical_list"
                    ? "grid-cols-1"
                    : "grid-cols-2"
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

          {/* Rodapé A4 Editorial */}
          <div
            style={{ borderColor: theme.border }}
            className="flex items-center justify-between border-t pt-2 text-[9px] font-mono"
          >
            <span style={{ color: theme.muted }}>
              {TECHNICAL_BADGES.standard} · {TECHNICAL_BADGES.tolerance}
            </span>
            <span style={{ color: theme.accent }}>
              WhatsApp: {formatWhatsappDisplay(contactPhone)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
