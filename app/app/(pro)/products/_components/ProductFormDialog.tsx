"use client";

/**
 * Editor ÚNICO de peça: custo, vitrine, mídia, canais de venda e notas internas
 * no mesmo lugar.
 *
 * Antes eram duas telas sobre a MESMA tabela: `/app/products` tinha o custo mas
 * não tinha descrição, links nem slug; `/app/landing-edit` tinha a vitrine. Por
 * isso cadastrar uma peça no CRM a mandava para o site sem nenhum botão de
 * compra. Uma tabela, um editor.
 *
 * As abas existem porque o formulário completo não cabe numa tela — mas a
 * ergonomia real está em "Salvar e próxima": preencher o custo de 18 peças é
 * digitação repetida, e cada clique a mais vira 18.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModelEstimate, type ModelOptionLite } from "./ModelEstimate";
import { ChannelMargins } from "./ChannelMargins";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { computeProductPricing } from "@/lib/pricing/engine";
import { brlFromReais } from "@/lib/format/money";
import { parseDecimal, formatDecimalInput } from "@/lib/format/decimal";
import { slugify } from "@/lib/utils/slug";
import { LINK_CHANNELS, LINK_CHANNEL_LABEL, type LinkChannel } from "@/lib/landing/links";
import type { ProductVariationGroup } from "@/lib/schemas/products-catalog";
import type { ProductView } from "@/app/actions/products/actions";
import MediaGallery from "@/components/products/MediaGallery";
import { ExtraCostsEditor, type ExtraCostDraft } from "@/components/products/ExtraCostsEditor";
import VariationsEditor from "./VariationsEditor";

export interface FilamentLite { id: string; name: string; costPerGram: number }
export interface PrinterLite { id: string; name: string }

/** Payload do wire — camelCase, igual ao `productFullPatchSchema`. */
export interface ProductFormPayload {
  name: string;
  slug?: string;
  category: string;
  description: string;
  heroCopy: string;
  material: string;
  dimensions: string;
  priceRange: string;
  colors: string[];
  variations: ProductVariationGroup[];
  isTop: boolean;
  isPublished: boolean;
  images: string[];
  videos: string[];
  salePriceCents: number | null;
  stockQty: number;
  links: Record<string, string>;
  filamentClientId: string | null;
  filamentGrams: number;
  printTimeMinutes: number;
  printerClientId: string | null;
  extraCosts: ExtraCostDraft[];
  marginPct: number;
  observations: string;
  buyerProfile?: string;
  modelSource: "proprio" | "livre" | "terceiro" | "desconhecido";
  modelLicense: string;
  /** STL vinculado (0077) e a proveniência da estimativa. */
  modelId: string | null;
  costEstimatedAt: string | null;
  costEstimateSource: Record<string, unknown>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Null = criar; um ProductView = editar aquela peça. */
  product: ProductView | null;
  filaments: FilamentLite[];
  printers: PrinterLite[];
  /** STL do repositório, para vincular e estimar. */
  models: ModelOptionLite[];
  /** Alíquota do Simples da organização. 0 = não configurada. */
  simplesTaxPct: number;
  /** Links da loja — mostrados como placeholder do que a peça vai herdar. */
  globalLinks: Record<string, string>;
  kEnergy: number;
  onSubmit: (payload: ProductFormPayload) => Promise<boolean>;
  /** Existindo, habilita "Salvar e próxima →". */
  onSaveAndNext?: () => void;
}

function Field({
  label, htmlFor, hint, children,
}: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProductFormDialog({
  open, onOpenChange, product, filaments, printers, models, simplesTaxPct,
  globalLinks, kEnergy, onSubmit, onSaveAndNext,
}: Props) {
  const isEdit = product !== null;

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [heroCopy, setHeroCopy] = useState(product?.heroCopy ?? "");
  const [material, setMaterial] = useState(product?.material ?? "");
  const [dimensions, setDimensions] = useState(product?.dimensions ?? "");
  const [priceRange, setPriceRange] = useState(product?.priceRange ?? "");
  const [colors, setColors] = useState((product?.colors ?? []).join(", "));
  const [variations, setVariations] = useState<ProductVariationGroup[]>(product?.variations ?? []);
  const [isTop, setIsTop] = useState(product?.isTop ?? false);
  const [published, setPublished] = useState(product?.isPublished ?? false);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [videos, setVideos] = useState<string[]>(product?.videos ?? []);
  const [salePrice, setSalePrice] = useState(
    product?.salePriceCents != null ? formatDecimalInput(product.salePriceCents / 100, 2) : "",
  );
  const [stockQty, setStockQty] = useState(product ? String(product.stockQty) : "0");
  const [links, setLinks] = useState<Record<string, string>>(product?.links ?? {});
  const [filamentId, setFilamentId] = useState(product?.filamentClientId ?? "");
  const [grams, setGrams] = useState(formatDecimalInput(product?.filamentGrams ?? 0));
  const [minutes, setMinutes] = useState(
    formatDecimalInput(product ? Math.round(product.printTimeSeconds / 60) : 0),
  );
  const [printerId, setPrinterId] = useState(product?.printerClientId ?? "");
  const [extraCosts, setExtraCosts] = useState<ExtraCostDraft[]>(product?.extraCosts ?? []);
  const [margin, setMargin] = useState(product ? String(product.marginPct) : "100");
  const [observations, setObservations] = useState(product?.observations ?? "");
  const [buyerProfile, setBuyerProfile] = useState(product?.buyerProfile ?? "");
  const [modelSource, setModelSource] = useState(product?.modelSource ?? "desconhecido");
  const [modelLicense, setModelLicense] = useState(product?.modelLicense ?? "");
  const [modelId, setModelId] = useState(product?.modelId ?? "");
  // Proveniência: só muda quando a estimativa roda AGORA. Sem isso, editar o
  // nome da peça reescreveria a data e faria um valor antigo parecer recém-medido.
  const [estimatedAt, setEstimatedAt] = useState(product?.costEstimatedAt ?? null);
  const [estimateSource, setEstimateSource] = useState<Record<string, unknown>>(
    product?.costEstimateSource ?? {},
  );

  const [tab, setTab] = useState("custo");
  const [pending, startTransition] = useTransition();
  const gramsRef = useRef<HTMLInputElement>(null);

  /**
   * Preencher custo é a tarefa repetitiva: ao abrir uma peça existente o foco já
   * cai em Gramas, então "Salvar e próxima" encadeia sem tocar no mouse.
   */
  useEffect(() => {
    if (open && isEdit && tab === "custo") {
      const timer = setTimeout(() => gramsRef.current?.select(), 60);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open, isEdit, tab, product?.id]);

  // Mesmo motor do servidor: os números da tela não podem divergir dos gravados.
  const pricing = useMemo(() => {
    const fil = filaments.find((f) => f.id === filamentId);
    return computeProductPricing({
      filamentGrams: parseDecimal(grams),
      costPerGram: fil?.costPerGram ?? 0,
      printTimeSeconds: Math.round(parseDecimal(minutes) * 60),
      kEnergy,
      extraCostCents: extraCosts.reduce((s, e) => s + e.costCents, 0),
      marginPct: parseDecimal(margin),
    });
  }, [filaments, filamentId, grams, minutes, kEnergy, extraCosts, margin]);

  function buildPayload(): ProductFormPayload {
    const trimmedSlug = slug.trim();
    return {
      name: name.trim(),
      // Slug só viaja quando o usuário escreveu um; na criação o servidor deriva
      // do nome, e num edit sem alteração não faz sentido reenviá-lo.
      ...(trimmedSlug ? { slug: trimmedSlug } : {}),
      category: category.trim(),
      description: description.trim(),
      heroCopy: heroCopy.trim(),
      material: material.trim(),
      dimensions: dimensions.trim(),
      priceRange: priceRange.trim(),
      colors: colors.split(",").map((c) => c.trim()).filter(Boolean),
      // Grupo sem nome reprovaria no Zod do servidor; descarta em silêncio.
      variations: variations
        .map((g) => ({ name: g.name.trim(), options: g.options }))
        .filter((g) => g.name.length > 0),
      isTop,
      isPublished: published,
      images,
      videos,
      salePriceCents: salePrice.trim() ? Math.round(parseDecimal(salePrice) * 100) : null,
      stockQty: Math.max(0, Math.round(parseDecimal(stockQty))),
      // Canal vazio é removido: assim a peça volta a herdar o link da loja em vez
      // de ficar com string vazia gravada.
      links: Object.fromEntries(
        LINK_CHANNELS.map((c) => [c, (links[c] ?? "").trim()]).filter(([, v]) => v),
      ) as Record<string, string>,
      filamentClientId: filamentId || null,
      filamentGrams: parseDecimal(grams),
      printTimeMinutes: parseDecimal(minutes),
      printerClientId: printerId || null,
      extraCosts: extraCosts.filter((e) => e.costCents > 0 || e.label.trim().length > 0),
      marginPct: parseDecimal(margin) || 0,
      observations: observations.trim(),
      // Só viaja quando há algo a gravar OU quando o usuário está limpando um
      // valor que existia. Assim, quem nunca usa o campo não depende da
      // migration 0069 estar aplicada para conseguir salvar o resto da peça.
      ...(buyerProfile.trim() || product?.buyerProfile
        ? { buyerProfile: buyerProfile.trim() }
        : {}),
      modelSource,
      modelLicense: modelLicense.trim(),
      modelId: modelId || null,
      costEstimatedAt: estimatedAt,
      costEstimateSource: estimateSource,
    };
  }

  function submit(next: boolean) {
    if (!name.trim()) {
      setTab("custo");
      return toast.error("Informe o nome da peça");
    }
    startTransition(async () => {
      const saved = await onSubmit(buildPayload());
      if (!saved) return;
      if (next && onSaveAndNext) onSaveAndNext();
      else onOpenChange(false);
    });
  }

  const slugPreview = slug.trim() || slugify(name) || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[88vh] flex-col overflow-hidden sm:max-w-2xl"
        onKeyDown={(e) => {
          // Ctrl/Cmd+Enter grava de qualquer aba, sem caçar o botão.
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit(false);
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar: ${product.name}` : "Nova peça"}</DialogTitle>
        </DialogHeader>

        {/* Identificação fica fora das abas: é o que orienta em qualquer uma. */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" htmlFor="p-name">
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Luminária Lua" />
          </Field>
          <Field label="Nicho" htmlFor="p-cat">
            <Input id="p-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Luminárias" />
          </Field>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="custo">Custo</TabsTrigger>
            <TabsTrigger value="canais">Canais</TabsTrigger>
            <TabsTrigger value="vitrine">Vitrine</TabsTrigger>
            <TabsTrigger value="midia">Mídia</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="interno">Interno</TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 pt-4">
            {/* ── CUSTO ─────────────────────────────────────────────────── */}
            <TabsContent value="custo" className="mt-0 space-y-4">
              <Field label="Filamento" htmlFor="p-fil" hint="O custo por grama vem do cadastro em Impressoras & Filamentos.">
                <Combobox
                  id="p-fil"
                  value={filamentId}
                  onChange={setFilamentId}
                  options={[
                    { value: "", label: "— Selecione —" },
                    ...filaments.map((f) => ({
                      value: f.id, label: f.name, hint: `R$ ${f.costPerGram.toFixed(3)}/g`,
                    })),
                  ]}
                  searchPlaceholder="Buscar filamento…"
                />
              </Field>

              <ModelEstimate
                models={models}
                modelId={modelId}
                onModelChange={setModelId}
                onEstimated={({ grams: g, minutes: m, source }) => {
                  setGrams(formatDecimalInput(g));
                  setMinutes(formatDecimalInput(m));
                  setEstimatedAt(new Date().toISOString());
                  setEstimateSource(source);
                }}
                estimatedAt={estimatedAt}
                estimateSource={estimateSource}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Gramas" htmlFor="p-grams" hint="Do fatiador ou da balança.">
                  <Input
                    id="p-grams" ref={gramsRef} inputMode="decimal"
                    value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="45"
                  />
                </Field>
                <Field label="Tempo (min)" htmlFor="p-min" hint="Do fatiador ou do cronômetro.">
                  <Input
                    id="p-min" inputMode="decimal"
                    value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="180"
                  />
                </Field>
              </div>

              <Field label="Impressora" htmlFor="p-prn" hint="Define energia e depreciação. Sem vínculo, usa 200 W e R$ 0,40/h.">
                <Combobox
                  id="p-prn"
                  value={printerId}
                  onChange={setPrinterId}
                  options={[
                    { value: "", label: "— Selecione —" },
                    ...printers.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  searchPlaceholder="Buscar impressora…"
                />
              </Field>

              <Field label="Insumos">
                <ExtraCostsEditor value={extraCosts} onChange={setExtraCosts} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Margem (%)" htmlFor="p-margin">
                  <Input id="p-margin" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} />
                </Field>
                <Field label="Preço de venda (R$)" htmlFor="p-price" hint="Publicar na vitrine exige preço.">
                  <Input
                    id="p-price" inputMode="decimal"
                    value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="49,90"
                  />
                </Field>
              </div>

              {/* Breakdown ao vivo: o mesmo motor que o servidor usa ao gravar. */}
              <div className="rounded-lg border border-border bg-surface-elevated p-3 text-xs">
                <CostRow label="Material" value={pricing.materialCost} />
                <CostRow label="Energia" value={pricing.energyCost} />
                <CostRow label="Depreciação" value={pricing.depreciationCost} />
                <CostRow label="Insumos" value={pricing.extrasCost} />
                <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                  <span>Custo total</span>
                  <span className="tabular-nums">{brlFromReais(pricing.totalCost)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-accent">
                  <span className="font-medium">Preço sugerido</span>
                  <span className="font-bold tabular-nums">{brlFromReais(pricing.suggestedPrice)}</span>
                </div>
                {pricing.totalCost === 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Zerado porque gramas e tempo ainda são 0 — não é erro de cálculo, é dado faltando.
                  </p>
                )}
              </div>

              <div className="flex h-10 items-center justify-between rounded-sm border border-border px-3">
                <Label htmlFor="p-pub" className="text-xs font-medium">Visível na landing</Label>
                <Switch id="p-pub" checked={published} onCheckedChange={setPublished} />
              </div>
            </TabsContent>

            {/* ── VITRINE ───────────────────────────────────────────────── */}
            <TabsContent value="canais" className="mt-0 space-y-4">
              <ChannelMargins
                unitCost={pricing.totalCost}
                sellingPrice={salePrice.trim() ? parseDecimal(salePrice) : 0}
                simplesTaxPct={simplesTaxPct}
              />
            </TabsContent>

            <TabsContent value="vitrine" className="mt-0 space-y-4">
              <Field label="Endereço na loja (slug)" htmlFor="p-slug" hint={`A peça ficará em /product/${slugPreview}`}>
                <Input
                  id="p-slug" value={slug} onChange={(e) => setSlug(e.target.value)}
                  placeholder={slugify(name) || "luminaria-lua-cheia"}
                />
              </Field>
              <Field label="Descrição" htmlFor="p-desc" hint="Aparece no card e na página da peça.">
                <Textarea id="p-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <Field label="Texto de destaque" htmlFor="p-hero" hint="Usado quando a peça está no pódio de mais vendidos.">
                <Textarea id="p-hero" rows={3} value={heroCopy} onChange={(e) => setHeroCopy(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Material (vitrine)" htmlFor="p-mat" hint="Texto para o cliente, ex.: PLA Premium.">
                  <Input id="p-mat" value={material} onChange={(e) => setMaterial(e.target.value)} />
                </Field>
                <Field label="Dimensões" htmlFor="p-dim">
                  <Input id="p-dim" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="15cm x 15cm" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cores" htmlFor="p-colors" hint="Separadas por vírgula.">
                  <Input id="p-colors" value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Branco, Preto" />
                </Field>
                <Field label="Faixa de preço" htmlFor="p-range" hint="Opcional, ex.: 16,90 - 32,90.">
                  <Input id="p-range" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} />
                </Field>
              </div>
              <Field label="Variações">
                <VariationsEditor value={variations} onChange={setVariations} />
              </Field>
              <div className="flex h-10 items-center justify-between rounded-sm border border-border px-3">
                <Label htmlFor="p-top" className="text-xs font-medium">Selo &quot;Destaque&quot;</Label>
                <Switch id="p-top" checked={isTop} onCheckedChange={setIsTop} />
              </div>
            </TabsContent>

            {/* ── MÍDIA ─────────────────────────────────────────────────── */}
            <TabsContent value="midia" className="mt-0">
              <MediaGallery
                images={images}
                videos={videos}
                onChangeImages={setImages}
                onChangeVideos={setVideos}
              />
              <p className="mt-3 text-[11px] text-muted-foreground">
                A primeira imagem é a capa. Peça sem foto aparece na loja como
                &quot;Foto em produção&quot;.
              </p>
            </TabsContent>

            {/* ── LINKS ─────────────────────────────────────────────────── */}
            <TabsContent value="links" className="mt-0 space-y-4">
              <p className="text-[11px] leading-snug text-muted-foreground">
                Deixe vazio para herdar o link da loja. Preencha só quando o
                anúncio tiver endereço próprio.
              </p>
              {LINK_CHANNELS.map((channel: LinkChannel) => {
                const inherited = globalLinks[channel];
                return (
                  <Field
                    key={channel}
                    label={LINK_CHANNEL_LABEL[channel]}
                    htmlFor={`p-link-${channel}`}
                    hint={
                      links[channel]?.trim()
                        ? "Sobrescreve o link da loja."
                        : inherited
                          ? `Herdado da loja: ${inherited}`
                          : "Sem link da loja para herdar — configure em Landing Edit › Links."
                    }
                  >
                    <Input
                      id={`p-link-${channel}`}
                      value={links[channel] ?? ""}
                      onChange={(e) => setLinks((prev) => ({ ...prev, [channel]: e.target.value }))}
                      // Placeholder, nunca valor: preencher o input transformaria
                      // o herdado em override na primeira gravação.
                      placeholder={inherited ?? "https://…"}
                    />
                  </Field>
                );
              })}
            </TabsContent>

            {/* ── INTERNO ───────────────────────────────────────────────── */}
            <TabsContent value="interno" className="mt-0 space-y-4">
              <Field
                label="Geralmente quem compra"
                htmlFor="p-buyer"
                hint="Uso interno — nunca aparece na loja. Ex.: presente de dia das mães; fã de anime 18-30."
              >
                <Textarea id="p-buyer" rows={3} value={buyerProfile} onChange={(e) => setBuyerProfile(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Origem do modelo"
                  htmlFor="p-model-source"
                  hint="Decide se o ARQUIVO pode ser distribuído."
                >
                  <Combobox
                    id="p-model-source"
                    value={modelSource}
                    onChange={(v) => setModelSource(v as typeof modelSource)}
                    options={[
                      { value: "desconhecido", label: "Não classificado" },
                      { value: "proprio", label: "Modelo próprio", hint: "pode distribuir" },
                      { value: "livre", label: "Licença livre", hint: "pode distribuir" },
                      { value: "terceiro", label: "De terceiro", hint: "não distribuir arquivo" },
                    ]}
                    searchPlaceholder="Buscar…"
                  />
                </Field>
                <Field label="Licença / fonte" htmlFor="p-model-license" hint="Ex.: CC-BY 4.0 — printables.com/model/123">
                  <Input
                    id="p-model-license"
                    value={modelLicense}
                    onChange={(e) => setModelLicense(e.target.value)}
                  />
                </Field>
              </div>
              <p className="rounded-md border border-border bg-surface-elevated p-2 text-[11px] leading-snug text-muted-foreground">
                Vender a peça <strong>impressa</strong> e distribuir o <strong>arquivo STL</strong>
                {" "}são coisas diferentes. Esta marcação é o que separa o que pode entrar num pack
                de arquivos. Nada é classificado automaticamente.
              </p>

              <Field label="Observações" htmlFor="p-obs" hint="Notas de produção, fornecedor, ajustes de slicer.">
                <Textarea id="p-obs" rows={4} value={observations} onChange={(e) => setObservations(e.target.value)} />
              </Field>
              <Field label="Estoque pronto" htmlFor="p-stock" hint="Peças já impressas. O sistema baixa sozinho quando a venda vira paga.">
                <Input id="p-stock" inputMode="numeric" value={stockQty} onChange={(e) => setStockQty(e.target.value)} className="w-32" />
              </Field>
              {isEdit && (
                <p className="text-[11px] text-muted-foreground">
                  Vendidas até agora: <strong className="text-text">{product.soldQty}</strong> —
                  contador alimentado pelas vendas vinculadas a esta peça.
                </p>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="gap-2 border-t border-border pt-3 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <div className="flex gap-2">
            {onSaveAndNext && (
              <Button variant="outline" onClick={() => submit(true)} disabled={pending}>
                Salvar e próxima →
              </Button>
            )}
            <Button onClick={() => submit(false)} disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar" : "Criar peça"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{brlFromReais(value)}</span>
    </div>
  );
}
