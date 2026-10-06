"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FilePdf,
  WhatsappLogo,
  Copy,
  Check,
  Funnel,
  Sparkle,
  GridFour,
  Square,
  Eye,
  Sliders,
  CheckSquare,
  SquareLogo,
  Globe,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import type { CatalogProductDetail } from "@/app/actions/catalog/actions";
import { formatCatalogForWhatsApp } from "@/lib/catalog/whatsapp-formatter";
import { generateCatalogPdf } from "@/lib/catalog/pdf-generator";

interface CatalogEditorClientProps {
  initialProducts: CatalogProductDetail[];
  categories: string[];
}

export function CatalogEditorClient({
  initialProducts,
  categories,
}: CatalogEditorClientProps) {
  // --- Estados de Seleção e Filtro -------------------------------------------
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialProducts.map((p) => p.id)),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("todas");
  const [filterOnlyStock, setFilterOnlyStock] = useState(false);
  const [filterOnlyBestsellers, setFilterOnlyBestsellers] = useState(false);

  // --- Estados de Configuração Visual ---------------------------------------
  const [priceMode, setPriceMode] = useState<"varejo" | "atacado" | "custo">("varejo");
  const [wholesaleDiscountPct, setWholesaleDiscountPct] = useState(15);
  const [layoutMode, setLayoutMode] = useState<"grid" | "detail">("grid");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [includeDimensions, setIncludeDimensions] = useState(true);
  const [includeMaterial, setIncludeMaterial] = useState(true);
  const [includeLinks, setIncludeLinks] = useState(true);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // --- Filtragem dos Produtos -----------------------------------------------
  const filteredProducts = useMemo(() => {
    return initialProducts.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCat = p.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesCat) return false;
      }
      if (selectedCategory !== "todas" && p.category !== selectedCategory) {
        return false;
      }
      if (filterOnlyStock && (p.stock_qty ?? 0) <= 0) {
        return false;
      }
      if (filterOnlyBestsellers && !p.is_bestseller) {
        return false;
      }
      return true;
    });
  }, [initialProducts, searchQuery, selectedCategory, filterOnlyStock, filterOnlyBestsellers]);

  // Lista dos selecionados em ordem
  const activeSelectedProducts = useMemo(() => {
    return initialProducts.filter((p) => selectedIds.has(p.id));
  }, [initialProducts, selectedIds]);

  // Handlers de seleção
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredProducts.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function clearAllSelection() {
    setSelectedIds(new Set());
  }

  // --- Ações de Exportação --------------------------------------------------
  async function handleExportPdf() {
    if (activeSelectedProducts.length === 0) {
      toast.error("Selecione pelo menos um produto para exportar.");
      return;
    }
    try {
      setIsGeneratingPdf(true);
      const blob = await generateCatalogPdf(activeSelectedProducts, {
        storeName: "GLTECH3D",
        priceMode,
        wholesaleDiscountPct,
        layoutMode,
        theme,
        includeDimensions,
        includeMaterial,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Catalogo-GLTECH-${priceMode}-${layoutMode}-${Date.now().toString(36)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF gerado e baixado com sucesso!");
    } catch (err) {
      toast.error(`Falha ao gerar PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  function handleCopyWhatsAppText() {
    if (activeSelectedProducts.length === 0) {
      toast.error("Selecione pelo menos um produto para copiar.");
      return;
    }
    const text = formatCatalogForWhatsApp(activeSelectedProducts, {
      storeName: "GLTECH3D",
      priceMode,
      wholesaleDiscountPct,
      includeDimensions,
      includeMaterial,
      includeLinks,
    });

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    toast.success("Texto formatado para WhatsApp copiado para a área de transferência!");
    setTimeout(() => setCopiedText(false), 3000);
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* ── Painel Esquerdo: Controles & Seleção ────────────────────────── */}
      <div className="w-full space-y-6 lg:w-96 xl:w-[420px] shrink-0">
        {/* Ações de Saída Principais */}
        <Card className="space-y-4 p-5 border-amber-500/20 bg-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkle className="h-4 w-4 text-amber-500" />
              Exportar Catálogo
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono">
              {activeSelectedProducts.length} selecionados
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs gap-1.5 h-10"
              disabled={isGeneratingPdf || activeSelectedProducts.length === 0}
              onClick={handleExportPdf}
            >
              <FilePdf className="h-4 w-4" />
              {isGeneratingPdf ? "Gerando PDF..." : "Exportar PDF"}
            </Button>

            <Button
              variant="outline"
              className="border-green-600/30 text-green-600 hover:bg-green-500/10 text-xs gap-1.5 h-10"
              disabled={activeSelectedProducts.length === 0}
              onClick={handleCopyWhatsAppText}
            >
              {copiedText ? <Check className="h-4 w-4 text-green-500" /> : <WhatsappLogo className="h-4 w-4" />}
              {copiedText ? "Copiado!" : "Copiar p/ Whats"}
            </Button>
          </div>

          <a
            href="/catalogo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground pt-1"
          >
            <Globe className="h-3.5 w-3.5" />
            Abrir Vitrine Pública na Web
          </a>
        </Card>

        {/* Opções de Design & Preço */}
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            Personalização & Preços
          </h2>

          {/* Tabela de Preço */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tabela de Preço</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["varejo", "atacado", "custo"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPriceMode(mode)}
                  className={`rounded-md border py-1.5 px-2 text-xs capitalize font-medium transition-colors ${
                    priceMode === mode
                      ? "border-amber-500 bg-amber-500/10 text-amber-500"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {priceMode === "atacado" && (
            <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center justify-between text-xs">
                <Label className="text-xs font-medium text-amber-500">Desconto Atacado (%)</Label>
                <span className="font-mono font-bold text-amber-500">{wholesaleDiscountPct}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={wholesaleDiscountPct}
                onChange={(e) => setWholesaleDiscountPct(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          )}

          {/* Layout do Grid */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Formato de Disposição</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLayoutMode("grid")}
                className={`flex items-center justify-center gap-2 rounded-md border py-2 px-3 text-xs font-medium transition-colors ${
                  layoutMode === "grid"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <GridFour className="h-4 w-4" />
                Grade 2x2 (4/pág)
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("detail")}
                className={`flex items-center justify-center gap-2 rounded-md border py-2 px-3 text-xs font-medium transition-colors ${
                  layoutMode === "detail"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <Square className="h-4 w-4" />
                Ficha 1x1 (1/pág)
              </button>
            </div>
          </div>

          {/* Estilo e Tema */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tema Visual do PDF</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`rounded-md border py-1.5 px-3 text-xs font-medium transition-colors ${
                  theme === "dark"
                    ? "border-primary bg-slate-900 text-amber-400"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                🌙 GLTECH Dark
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`rounded-md border py-1.5 px-3 text-xs font-medium transition-colors ${
                  theme === "light"
                    ? "border-primary bg-slate-100 text-slate-900"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                ☀️ Clean Light
              </button>
            </div>
          </div>

          {/* Toggles de Exibição */}
          <div className="space-y-2 pt-1 border-t border-border">
            <Label className="text-xs font-medium text-muted-foreground">Informações Visíveis</Label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMaterial}
                  onChange={(e) => setIncludeMaterial(e.target.checked)}
                  className="rounded border-gray-300 accent-primary"
                />
                Material (PLA)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDimensions}
                  onChange={(e) => setIncludeDimensions(e.target.checked)}
                  className="rounded border-gray-300 accent-primary"
                />
                Dimensões
              </label>
              <label className="flex items-center gap-2 cursor-pointer col-span-2">
                <input
                  type="checkbox"
                  checked={includeLinks}
                  onChange={(e) => setIncludeLinks(e.target.checked)}
                  className="rounded border-gray-300 accent-primary"
                />
                Links e QR Codes do WhatsApp
              </label>
            </div>
          </div>
        </Card>

        {/* Lista de Seleção de Produtos */}
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Funnel className="h-4 w-4 text-primary" />
              Seleção de Peças
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={selectAllFiltered}>
                Todos
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] text-destructive" onClick={clearAllSelection}>
                Limpar
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <div className="space-y-2">
            <Input
              placeholder="Buscar produto por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs"
            />

            <div className="flex items-center gap-2">
              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium"
                >
                  <option value="todas">Todas as categorias</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterOnlyStock}
                  onChange={(e) => setFilterOnlyStock(e.target.checked)}
                  className="rounded border-gray-300 accent-primary"
                />
                Com estoque
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterOnlyBestsellers}
                  onChange={(e) => setFilterOnlyBestsellers(e.target.checked)}
                  className="rounded border-gray-300 accent-primary"
                />
                Destaques
              </label>
            </div>
          </div>

          {/* Checklist dos Produtos */}
          <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/40">
            {filteredProducts.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Nenhum produto encontrado.</p>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleSelect(p.id)}
                    className={`flex items-center justify-between gap-3 p-2 rounded-md cursor-pointer transition-colors pt-2 ${
                      isSelected ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <SquareLogo className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}

                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(p.sale_price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          {p.category ? ` · ${p.category}` : ""}
                        </p>
                      </div>
                    </div>

                    {p.is_bestseller && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-500 shrink-0">
                        ★ Top
                      </Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* ── Painel Direito: Live Preview em Tempo Real ───────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">
        <Card className="p-4 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">Pré-Visualização ao Vivo do Catálogo</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Grid: {layoutMode === "grid" ? "2x2 (Grade)" : "1x1 (Ficha)"}</span>
            <span>·</span>
            <span>Tabela: {priceMode.toUpperCase()}</span>
          </div>
        </Card>

        {/* Canvas de Preview Estilizado */}
        <div
          className={`rounded-xl border p-6 transition-colors min-h-[600px] shadow-sm ${
            theme === "dark" ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-900 border-slate-200"
          }`}
        >
          {/* Header do Preview */}
          <div className="flex items-center justify-between border-b pb-4 mb-6 border-slate-800/40">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-amber-400">GLTECH3D</h1>
              <p className="text-xs text-slate-400">Catálogo Oficial de Peças & Peças 3D</p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400">
                {priceMode === "atacado"
                  ? `Atacado (-${wholesaleDiscountPct}%)`
                  : priceMode === "custo"
                  ? "Modo Custo"
                  : "Tabela Varejo"}
              </Badge>
              <p className="text-[11px] text-slate-400 mt-1">{activeSelectedProducts.length} itens selecionados</p>
            </div>
          </div>

          {activeSelectedProducts.length === 0 ? (
            <div className="py-24 text-center">
              <Sparkle className="h-8 w-8 text-amber-500/40 mx-auto mb-2 animate-pulse" />
              <p className="text-sm text-slate-400">Nenhum produto selecionado para o catálogo.</p>
              <p className="text-xs text-slate-500 mt-1">Marque as peças no painel à esquerda para visualizar.</p>
            </div>
          ) : layoutMode === "grid" ? (
            /* Grade 2x2 */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeSelectedProducts.map((p) => {
                let finalPrice = p.sale_price_cents;
                if (priceMode === "atacado") {
                  finalPrice = Math.round(p.sale_price_cents * (1 - wholesaleDiscountPct / 100));
                } else if (priceMode === "custo") {
                  finalPrice = p.cost_total_cents ?? p.sale_price_cents;
                }

                const priceStr = (finalPrice / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                });

                return (
                  <div
                    key={p.id}
                    className={`rounded-lg p-4 border flex flex-col justify-between ${
                      theme === "dark" ? "bg-slate-900/70 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-sm line-clamp-1">{p.name}</h3>
                        {p.is_bestseller && (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded shrink-0">
                            ★ TOP
                          </span>
                        )}
                      </div>

                      {p.hero_copy && <p className="text-xs italic text-slate-400 mb-2 line-clamp-2">{p.hero_copy}</p>}

                      <div className="space-y-1 text-xs text-slate-400 my-2">
                        {includeMaterial && p.material && <div>🧱 Material: {p.material}</div>}
                        {includeDimensions && p.dimensions && <div>📏 Tamanho: {p.dimensions}</div>}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/40 flex items-center justify-between">
                      <div>
                        <span className="text-base font-bold text-amber-400">{priceStr}</span>
                        {priceMode === "atacado" && (
                          <span className="text-[10px] text-slate-400 line-through block">
                            {(p.sale_price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {p.category ?? "Impressão 3D"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Ficha 1x1 (Detalhada) */
            <div className="space-y-6">
              {activeSelectedProducts.map((p) => {
                let finalPrice = p.sale_price_cents;
                if (priceMode === "atacado") {
                  finalPrice = Math.round(p.sale_price_cents * (1 - wholesaleDiscountPct / 100));
                } else if (priceMode === "custo") {
                  finalPrice = p.cost_total_cents ?? p.sale_price_cents;
                }

                const priceStr = (finalPrice / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                });

                return (
                  <div
                    key={p.id}
                    className={`rounded-lg p-6 border ${
                      theme === "dark" ? "bg-slate-900/70 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-base text-amber-400">{p.name}</h3>
                        {p.hero_copy && <p className="text-xs italic text-slate-400">{p.hero_copy}</p>}
                      </div>
                      <span className="text-xl font-extrabold text-amber-400">{priceStr}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs text-slate-300 pt-3 border-t border-slate-800/40">
                      <div>
                        <span className="font-semibold text-slate-400 block mb-1">Especificações:</span>
                        {includeMaterial && <div>• Material: {p.material || "PLA Premium"}</div>}
                        {includeDimensions && <div>• Dimensões: {p.dimensions || "Sob consulta"}</div>}
                        <div>• Tecnologia: FDM Alta Resolução</div>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-400 block mb-1">Garantia & Entrega:</span>
                        <div>• Envio seguro para todo o Brasil</div>
                        <div>• Produzido com inspeção de qualidade</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer do Preview */}
          <div className="mt-8 pt-4 border-t border-slate-800/40 flex items-center justify-between text-xs text-slate-400">
            <span>GLTECH3D · Impressão 3D e Projetos Especiais</span>
            <span>WhatsApp: (31) 99928-4834</span>
          </div>
        </div>
      </div>
    </div>
  );
}
