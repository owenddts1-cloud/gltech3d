"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Presentation,
  FilePdf,
  Eye,
  Sliders,
} from "@phosphor-icons/react/dist/ssr";

import type { CatalogProductDetail } from "@/app/actions/catalog/actions";
import type { CatalogProductItem } from "@/lib/catalog/whatsapp-formatter";
import { formatCatalogForWhatsApp } from "@/lib/catalog/whatsapp-formatter";
import {
  getThemeTokens,
  type CatalogLayoutMode,
  type EditorialThemeId,
} from "@/lib/catalog/editorial-design-system";
import { generateEditorialCatalogPdf } from "@/lib/catalog/editorial-pdf-engine";
import { CatalogConfigSidebar } from "./CatalogConfigSidebar";
import { WebSliderView } from "./views/WebSliderView";
import { A4PrintSheetView } from "./views/A4PrintSheetView";

interface CatalogEditorClientProps {
  initialProducts: CatalogProductDetail[];
  categories: string[];
}

export function CatalogEditorClient({
  initialProducts,
  categories,
}: CatalogEditorClientProps) {
  // Converte produtos para o formato padronizado de catálogo
  const catalogProducts: CatalogProductItem[] = useMemo(() => {
    return initialProducts.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      price_cents: p.price_cents,
      photo_url: p.photo_url,
      filament_grams: p.filament_grams,
      print_time_hours: p.print_time_hours,
      material: p.material,
      dimensions: p.dimensions,
      is_top: p.is_top,
    }));
  }, [initialProducts]);

  // Estados de Configuração Editorial (Agente 1 e 2)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialProducts.map((p) => p.id)),
  );
  const [themeId, setThemeId] = useState<EditorialThemeId>("warm_studio");
  const [layoutMode, setLayoutMode] = useState<CatalogLayoutMode>("grid_2x2");
  const [previewMode, setPreviewMode] = useState<"web_slider" | "a4_sheet">("web_slider");

  // Regras Comerciais (Agente 3)
  const [priceMode, setPriceMode] = useState<"varejo" | "atacado" | "sob_consulta">("varejo");
  const [wholesaleDiscountPct, setWholesaleDiscountPct] = useState(15);
  const [storeName, setStoreName] = useState("GLTECH3D");

  // Toggles de Metadados e Páginas
  const [showDimensions, setShowDimensions] = useState(true);
  const [showMaterial, setShowMaterial] = useState(true);
  const [showTolerances, setShowTolerances] = useState(true);
  const [includeCover, setIncludeCover] = useState(true);
  const [includeManifesto, setIncludeManifesto] = useState(true);
  const [includeBackcover, setIncludeBackcover] = useState(true);

  // Estados de Ação
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const selectedProducts = useMemo(() => {
    return catalogProducts.filter((p) => selectedIds.has(p.id));
  }, [catalogProducts, selectedIds]);

  const activeTheme = useMemo(() => getThemeTokens(themeId), [themeId]);

  function handleToggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedIds(new Set(catalogProducts.map((p) => p.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  async function handleExportPdf() {
    if (selectedProducts.length === 0) {
      toast.error("Selecione ao menos uma peça para gerar o catálogo.");
      return;
    }

    setIsExportingPdf(true);
    const toastId = toast.loading("Renderizando catálogo A4 em alta definição...");

    try {
      const blob = await generateEditorialCatalogPdf(selectedProducts, {
        theme: themeId,
        layoutMode,
        priceMode,
        wholesaleDiscountPct,
        includeCover,
        includeManifesto,
        includeBackcover,
        includeDimensions,
        includeMaterial,
        includeTolerances,
        storeName,
        onImageProgress: (done, total) => {
          toast.loading(`Carregando imagens (${done}/${total})...`, { id: toastId });
        },
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Catalogo-Tecnico-${storeName.replace(/\s+/g, "_")}-${layoutMode}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Catálogo PDF baixado com sucesso!", { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao compilar PDF do catálogo.", { id: toastId });
    } finally {
      setIsExportingPdf(false);
    }
  }

  function handleCopyWhatsappShowcase() {
    if (selectedProducts.length === 0) {
      toast.error("Nenhum produto selecionado.");
      return;
    }

    const text = formatCatalogForWhatsApp(selectedProducts, {
      storeName,
      priceMode: priceMode === "sob_consulta" ? "varejo" : priceMode,
      wholesaleDiscountPct,
      includeDimensions,
      includeMaterial,
    });

    navigator.clipboard.writeText(text);
    toast.success("Vitrine formatada copiada para o WhatsApp!");
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] min-h-[640px]">
      {/* Coluna Esquerda: Painel de Configurações */}
      <div className="w-full lg:w-84 xl:w-96 shrink-0 h-full">
        <CatalogConfigSidebar
          products={catalogProducts}
          categories={categories}
          selectedProductIds={selectedIds}
          onToggleProduct={handleToggleProduct}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          theme={themeId}
          onChangeTheme={setThemeId}
          layoutMode={layoutMode}
          onChangeLayout={setLayoutMode}
          priceMode={priceMode}
          onChangePriceMode={setPriceMode}
          wholesaleDiscountPct={wholesaleDiscountPct}
          onChangeWholesaleDiscountPct={setWholesaleDiscountPct}
          showDimensions={showDimensions}
          onToggleDimensions={setShowDimensions}
          showMaterial={showMaterial}
          onToggleMaterial={setShowMaterial}
          showTolerances={showTolerances}
          onToggleTolerances={setShowTolerances}
          includeCover={includeCover}
          onToggleCover={setIncludeCover}
          includeManifesto={includeManifesto}
          onToggleManifesto={setIncludeManifesto}
          includeBackcover={includeBackcover}
          onToggleBackcover={setIncludeBackcover}
          storeName={storeName}
          onChangeStoreName={setStoreName}
          onExportPdf={handleExportPdf}
          isExportingPdf={isExportingPdf}
          onCopyWhatsappShowcase={handleCopyWhatsappShowcase}
        />
      </div>

      {/* Coluna Direita: Live Preview Split-View */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Seletor de Modo de Visualização */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-1.5 rounded-lg border bg-surface p-1">
            <button
              type="button"
              onClick={() => setPreviewMode("web_slider")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                previewMode === "web_slider"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Presentation className="h-4 w-4" />
              Apresentação Web Slider
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("a4_sheet")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                previewMode === "a4_sheet"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FilePdf className="h-4 w-4" />
              Folha A4 Impressão
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>Tema: {activeTheme.name}</span>
          </div>
        </div>

        {/* Canvas de Renderização em Tempo Real */}
        <div className="flex-1 min-h-0">
          {previewMode === "web_slider" ? (
            <WebSliderView
              products={selectedProducts}
              theme={activeTheme}
              layoutMode={layoutMode}
              priceMode={priceMode}
              wholesaleDiscountPct={wholesaleDiscountPct}
              showDimensions={showDimensions}
              showMaterial={showMaterial}
              showTolerances={showTolerances}
              storeName={storeName}
            />
          ) : (
            <A4PrintSheetView
              products={selectedProducts}
              theme={activeTheme}
              layoutMode={layoutMode}
              priceMode={priceMode}
              wholesaleDiscountPct={wholesaleDiscountPct}
              showDimensions={showDimensions}
              showMaterial={showMaterial}
              showTolerances={showTolerances}
              storeName={storeName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
