"use client";

import React from "react";
import type { CatalogProductItem } from "@/lib/catalog/whatsapp-formatter";
import {
  type CatalogLayoutMode,
  type EditorialThemeId,
  CATALOG_LAYOUT_SPECS,
  EDITORIAL_THEMES,
} from "@/lib/catalog/editorial-design-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FilePdf,
  WhatsappLogo,
  Copy,
  MagnifyingGlass,
  Sliders,
  Check,
  DownloadSimple,
} from "@phosphor-icons/react/dist/ssr";

export interface FilterOptions {
  search: string;
  category: string;
}

export function filterCatalogProducts(
  products: CatalogProductItem[],
  { search, category }: FilterOptions,
): CatalogProductItem[] {
  const q = search.trim().toLowerCase();
  return products.filter((p) => {
    const matchCategory = category === "all" || !category || p.category === category;
    if (!matchCategory) return false;

    if (!q) return true;
    const nameMatch = p.name.toLowerCase().includes(q);
    const matMatch = (p.material || "").toLowerCase().includes(q);
    const catMatch = (p.category || "").toLowerCase().includes(q);
    return nameMatch || matMatch || catMatch;
  });
}

export interface CatalogConfigSidebarProps {
  products: CatalogProductItem[];
  categories: string[];
  selectedProductIds: Set<string>;
  onToggleProduct: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  theme: EditorialThemeId;
  onChangeTheme: (theme: EditorialThemeId) => void;
  layoutMode: CatalogLayoutMode;
  onChangeLayout: (layout: CatalogLayoutMode) => void;
  priceMode: "varejo" | "atacado" | "sob_consulta";
  onChangePriceMode: (mode: "varejo" | "atacado" | "sob_consulta") => void;
  wholesaleDiscountPct: number;
  onChangeWholesaleDiscountPct: (pct: number) => void;
  showDimensions: boolean;
  onToggleDimensions: (v: boolean) => void;
  showMaterial: boolean;
  onToggleMaterial: (v: boolean) => void;
  showTolerances: boolean;
  onToggleTolerances: (v: boolean) => void;
  includeCover: boolean;
  onToggleCover: (v: boolean) => void;
  includeManifesto: boolean;
  onToggleManifesto: (v: boolean) => void;
  includeBackcover: boolean;
  onToggleBackcover: (v: boolean) => void;
  storeName: string;
  onChangeStoreName: (name: string) => void;
  onExportPdf: () => void;
  isExportingPdf: boolean;
  onCopyWhatsappShowcase: () => void;
}

export function CatalogConfigSidebar({
  products,
  categories,
  selectedProductIds,
  onToggleProduct,
  onSelectAll,
  onDeselectAll,
  theme,
  onChangeTheme,
  layoutMode,
  onChangeLayout,
  priceMode,
  onChangePriceMode,
  wholesaleDiscountPct,
  onChangeWholesaleDiscountPct,
  showDimensions,
  onToggleDimensions,
  showMaterial,
  onToggleMaterial,
  showTolerances,
  onToggleTolerances,
  includeCover,
  onToggleCover,
  includeManifesto,
  onToggleManifesto,
  includeBackcover,
  onToggleBackcover,
  storeName,
  onChangeStoreName,
  onExportPdf,
  isExportingPdf,
  onCopyWhatsappShowcase,
}: CatalogConfigSidebarProps) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");

  const filteredProducts = React.useMemo(
    () => filterCatalogProducts(products, { search, category }),
    [products, search, category],
  );

  return (
    <div className="flex flex-col h-full gap-5 overflow-y-auto pr-1">
      {/* Botões Principais de Exportação */}
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          onClick={onExportPdf}
          disabled={isExportingPdf || selectedProductIds.size === 0}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center justify-center gap-2 shadow-md"
        >
          <FilePdf className="h-5 w-5" />
          {isExportingPdf ? "Compilando PDF A4..." : "Exportar Catálogo em PDF (A4)"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCopyWhatsappShowcase}
          disabled={selectedProductIds.size === 0}
          className="w-full flex items-center justify-center gap-2 text-xs"
        >
          <WhatsappLogo className="h-4 w-4 text-green-600" />
          Copiar Vitrine Textual p/ WhatsApp
        </Button>
      </div>

      {/* Identidade & Tema */}
      <div className="rounded-xl border bg-surface p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5" />
          1. Identidade & Tema
        </h3>

        <div>
          <Label className="text-xs">Nome da Marca / Oficina</Label>
          <Input
            value={storeName}
            onChange={(e) => onChangeStoreName(e.target.value)}
            className="h-8 text-xs mt-1"
            placeholder="GLTECH3D"
          />
        </div>

        <div>
          <Label className="text-xs">Paleta de Cores Editorial</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={() => onChangeTheme("warm_studio")}
              className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                theme === "warm_studio"
                  ? "border-amber-600 bg-amber-500/10 font-bold"
                  : "hover:bg-muted/50"
              }`}
            >
              <span className="block font-medium">Warm Studio</span>
              <span className="text-[10px] text-muted-foreground">Minimalista Claro</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeTheme("technical_monolith")}
              className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                theme === "technical_monolith"
                  ? "border-cyan-500 bg-cyan-500/10 font-bold"
                  : "hover:bg-muted/50"
              }`}
            >
              <span className="block font-medium">Monolith</span>
              <span className="text-[10px] text-muted-foreground">Industrial Escuro</span>
            </button>
          </div>
        </div>
      </div>

      {/* Diagramação & Layout */}
      <div className="rounded-xl border bg-surface p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          2. Diagramação & Layout da Grade
        </h3>

        <div className="grid grid-cols-2 gap-2">
          {Object.values(CATALOG_LAYOUT_SPECS).map((spec) => (
            <button
              key={spec.id}
              type="button"
              onClick={() => onChangeLayout(spec.id)}
              className={`p-2 rounded-lg border text-left text-xs transition-all ${
                layoutMode === spec.id
                  ? "border-primary bg-primary/10 font-bold"
                  : "hover:bg-muted/50"
              }`}
            >
              <span className="block font-semibold">{spec.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {spec.itemsPerPage} {spec.itemsPerPage === 1 ? "peça/pág." : "peças/pág."}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Regras Comerciais & Preços */}
      <div className="rounded-xl border bg-surface p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          3. Precificação Comercial
        </h3>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onChangePriceMode("varejo")}
            className={`py-1.5 px-2 rounded border text-xs text-center transition-all ${
              priceMode === "varejo" ? "border-primary bg-primary/10 font-bold" : "hover:bg-muted/50"
            }`}
          >
            Varejo
          </button>
          <button
            type="button"
            onClick={() => onChangePriceMode("atacado")}
            className={`py-1.5 px-2 rounded border text-xs text-center transition-all ${
              priceMode === "atacado" ? "border-primary bg-primary/10 font-bold" : "hover:bg-muted/50"
            }`}
          >
            Atacado
          </button>
          <button
            type="button"
            onClick={() => onChangePriceMode("sob_consulta")}
            className={`py-1.5 px-2 rounded border text-xs text-center transition-all ${
              priceMode === "sob_consulta" ? "border-amber-600 bg-amber-500/10 font-bold text-amber-600" : "hover:bg-muted/50"
            }`}
          >
            Sob Consulta
          </button>
        </div>

        {priceMode === "atacado" && (
          <div>
            <Label className="text-xs">Desconto de Atacado (%)</Label>
            <Input
              type="number"
              min={1}
              max={80}
              value={wholesaleDiscountPct}
              onChange={(e) => onChangeWholesaleDiscountPct(Number(e.target.value))}
              className="h-8 text-xs mt-1"
            />
          </div>
        )}
      </div>

      {/* Seções Editoriais e Metadados */}
      <div className="rounded-xl border bg-surface p-4 space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          4. Metadados Técnicos & Páginas
        </h3>

        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={includeCover}
            onChange={(e) => onToggleCover(e.target.checked)}
            className="rounded border-border"
          />
          <span>Incluir Capa Editorial de Impacto</span>
        </label>

        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={includeManifesto}
            onChange={(e) => onToggleManifesto(e.target.checked)}
            className="rounded border-border"
          />
          <span>Incluir Manifesto & Tabela de Polímeros</span>
        </label>

        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={includeBackcover}
            onChange={(e) => onToggleBackcover(e.target.checked)}
            className="rounded border-border"
          />
          <span>Incluir Contracapa & Termos de Garantia</span>
        </label>

        <div className="pt-2 border-t space-y-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showTolerances}
              onChange={(e) => onToggleTolerances(e.target.checked)}
              className="rounded border-border"
            />
            <span>Selo de Tolerância Mecânica (±0.05mm)</span>
          </label>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showDimensions}
              onChange={(e) => onToggleDimensions(e.target.checked)}
              className="rounded border-border"
            />
            <span>Exibir Dimensões Físicas (X × Y × Z)</span>
          </label>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showMaterial}
              onChange={(e) => onToggleMaterial(e.target.checked)}
              className="rounded border-border"
            />
            <span>Exibir Polímero / Filamento</span>
          </label>
        </div>
      </div>

      {/* Seleção de Produtos */}
      <div className="rounded-xl border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            5. Produtos Selecionados ({selectedProductIds.size}/{products.length})
          </h3>
          <div className="flex gap-2 text-[11px]">
            <button type="button" onClick={onSelectAll} className="text-primary hover:underline font-medium">
              Todos
            </button>
            <span>·</span>
            <button type="button" onClick={onDeselectAll} className="text-muted-foreground hover:underline">
              Limpar
            </button>
          </div>
        </div>

        {/* Busca e Filtro de Categoria */}
        <div className="space-y-2">
          <div className="relative">
            <MagnifyingGlass className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou material..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          {categories.length > 0 && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Todas as Categorias</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Lista de Checkboxes */}
        <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-border/40">
          {filteredProducts.map((p) => {
            const isSelected = selectedProductIds.has(p.id);
            return (
              <label
                key={p.id}
                className="flex items-center justify-between gap-2 pt-1.5 text-xs cursor-pointer hover:bg-muted/40 p-1 rounded"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleProduct(p.id)}
                    className="rounded border-border"
                  />
                  <span className="truncate">{p.name}</span>
                </div>
                <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
                  R$ {((p.price_cents ?? 0) / 100).toFixed(0)}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
