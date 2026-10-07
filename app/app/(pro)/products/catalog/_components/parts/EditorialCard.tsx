"use client";

import React from "react";
import Image from "next/image";
import type { CatalogProductItem } from "@/lib/catalog/whatsapp-formatter";
import {
  type EditorialThemeTokens,
  type CatalogLayoutMode,
  formatDimensionBadge,
  TECHNICAL_BADGES,
} from "@/lib/catalog/editorial-design-system";

export function formatCatalogPrice(
  priceCents: number,
  mode: "varejo" | "atacado" | "sob_consulta",
  wholesaleDiscountPct: number = 15,
): string {
  if (mode === "sob_consulta") return "Sob Consulta B2B";
  let finalCents = priceCents;
  if (mode === "atacado") {
    finalCents = Math.round(priceCents * (1 - wholesaleDiscountPct / 100));
  }
  return `R$ ${(finalCents / 100).toFixed(2).replace(".", ",")}`;
}

export interface EditorialCardProps {
  product: CatalogProductItem;
  theme: EditorialThemeTokens;
  layoutMode: CatalogLayoutMode;
  priceMode: "varejo" | "atacado" | "sob_consulta";
  wholesaleDiscountPct?: number;
  showDimensions?: boolean;
  showMaterial?: boolean;
  showTolerances?: boolean;
}

export function EditorialCard({
  product,
  theme,
  layoutMode,
  priceMode,
  wholesaleDiscountPct = 15,
  showDimensions = true,
  showMaterial = true,
  showTolerances = true,
}: EditorialCardProps) {
  const isDetail = layoutMode === "editorial_detail";
  const rawPriceCents = product.price_cents ?? product.sale_price_cents ?? 0;
  const formattedPrice = formatCatalogPrice(rawPriceCents, priceMode, wholesaleDiscountPct);
  const photoUrl = product.photo_url || product.image_url;
  const isTopItem = Boolean(product.is_top || product.is_bestseller);

  return (
    <div
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
        color: theme.fg,
      }}
      className={`relative flex flex-col overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-lg ${
        isDetail ? "p-6 md:p-8" : "p-4"
      }`}
    >
      {/* Imagem do Produto */}
      <div
        style={{ backgroundColor: theme.surfaceSubtle }}
        className={`relative flex items-center justify-center overflow-hidden rounded-lg ${
          isDetail ? "h-64 sm:h-80 w-full" : "h-40 sm:h-48 w-full"
        }`}
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={product.name}
            fill
            className="object-contain p-3 transition-transform duration-300 hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
            unoptimized
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 text-center p-4">
            <span style={{ color: theme.muted }} className="text-xs font-mono uppercase tracking-wider">
              Blueprint Técnico
            </span>
            <span style={{ color: theme.muted }} className="text-[10px]">
              Foto em renderização
            </span>
          </div>
        )}

        {/* Badge de Destaque Hero */}
        {isTopItem && (
          <span
            style={{ backgroundColor: theme.accent, color: "#fff" }}
            className="absolute top-2 left-2 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          >
            Destaque
          </span>
        )}
      </div>

      {/* Detalhes Técnicos */}
      <div className="mt-3 flex flex-1 flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span
              style={{ color: theme.accent }}
              className="text-[10px] font-mono font-semibold uppercase tracking-wider"
            >
              {product.category || "Manufatura Aditiva"}
            </span>
            {showTolerances && (
              <span
                style={{ backgroundColor: theme.tagBg, color: theme.muted }}
                className="rounded px-1.5 py-0.5 text-[9px] font-mono"
              >
                ±0.05mm
              </span>
            )}
          </div>

          <h3 className={`mt-1 font-bold tracking-tight line-clamp-2 ${isDetail ? "text-xl sm:text-2xl" : "text-sm"}`}>
            {product.name}
          </h3>

          <div className="mt-2 space-y-1 text-xs">
            {showMaterial && (
              <p style={{ color: theme.muted }} className="text-[11px]">
                <strong className="font-medium text-foreground">Polímero:</strong> {product.material || "PETG Industrial"}
              </p>
            )}
            {showDimensions && (
              <p style={{ color: theme.muted }} className="text-[11px] font-mono">
                <strong className="font-medium font-sans text-foreground">Dimensões:</strong>{" "}
                {formatDimensionBadge(product.dimensions)}
              </p>
            )}
            {product.filament_grams ? (
              <p style={{ color: theme.muted }} className="text-[11px] font-mono">
                <strong className="font-medium font-sans text-foreground">Massa:</strong> {product.filament_grams}g
              </p>
            ) : null}
          </div>
        </div>

        {/* Preço / Cotação */}
        <div
          style={{ borderColor: theme.border }}
          className="mt-4 flex items-center justify-between border-t pt-3"
        >
          <div>
            <span style={{ color: theme.muted }} className="block text-[10px] uppercase font-mono tracking-wider">
              {priceMode === "sob_consulta" ? "Engenharia B2B" : priceMode === "atacado" ? "Atacado Especial" : "Valor Unitário"}
            </span>
            <span
              style={{ color: priceMode === "sob_consulta" ? theme.accent : theme.fg }}
              className={`font-bold ${isDetail ? "text-xl" : "text-base"}`}
            >
              {formattedPrice}
            </span>
          </div>

          <div
            style={{ backgroundColor: theme.tagBg, color: theme.accent }}
            className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider font-mono"
          >
            GLTECH 3D
          </div>
        </div>
      </div>
    </div>
  );
}
