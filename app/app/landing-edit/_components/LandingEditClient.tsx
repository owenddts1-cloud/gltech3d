'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Trophy, EyeOff, Search, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAutosave } from '@/hooks/useAutosave';
import { buildDraftCatalog } from '@/lib/landing/draft';
import type { LandingProductAdmin, PlatformCommission } from '@/app/actions/landing/actions';
import {
  createLandingProduct,
  deleteLandingProduct,
  setBestsellerRank,
  updateLandingProduct,
  updateLandingSettings,
  updatePlatformCommission,
} from '@/app/actions/landing/actions';
import type { LandingProductPatch } from '@/lib/schemas/landing-edit';
import type { LandingSection, LandingSectionItem } from '@/lib/landing/types';
import ProductEditor from './ProductEditor';
import LivePreview from './LivePreview';
import SaveIndicator from './SaveIndicator';
import CategoryPanel from './CategoryPanel';
import LinksPanel from './LinksPanel';
import BannerPicker from './BannerPicker';
import SectionItemsEditor, { type ItemKind } from './SectionItemsEditor';

interface Props {
  /** Slug da org ativa quando ela NÃO é a dona da landing. Null = tudo certo. */
  orgMismatch: string | null;
  landingOrgSlug: string;
  initialProducts: LandingProductAdmin[];
  initialSettings: { sections: Record<string, LandingSection>; links: Record<string, string> };
  initialCommissions: PlatformCommission[];
  filaments: { id: string; name: string; costPerGram: number }[];
  printers: { id: string; name: string }[];
  kEnergy: number;
}

/** Seções da landing que têm texto editável. */
const EDITABLE_SECTIONS: {
  key: string;
  label: string;
  banner?: boolean;
  /** Seção com lista editável + a lista padrão que o site usa hoje. */
  list?: { kind: ItemKind; fallback: LandingSectionItem[] };
  defaults: LandingSection;
}[] = [
  {
    key: 'hero',
    label: 'Topo da página (Hero)',
    banner: true,
    defaults: {
      eyebrow: 'Impressão 3D • Feito no Brasil',
      title: 'Do arquivo 3D',
      subtitle: 'à realidade',
    },
  },
  {
    key: 'categorias',
    label: 'Navegar por Nichos',
    defaults: {
      eyebrow: 'Navegar Catálogo',
      title: 'Navegar por Nichos',
      subtitle: 'Busque pelo nome da peça ou filtre pelo nicho.',
    },
  },
  {
    key: 'bestsellers',
    label: 'Pódio (Mais Vendidos)',
    defaults: { eyebrow: 'O que mais sai da oficina', title: 'Mais Vendidos' },
  },
  {
    key: 'galeria',
    label: 'Galeria de Peças',
    defaults: { eyebrow: 'Nossa Coleção', title: 'Galeria de Peças' },
  },
  {
    key: 'como_funciona',
    label: 'Como Funciona',
    defaults: { eyebrow: 'Como funciona', title: 'Da ideia à peça na sua mão' },
    // Espelha DEFAULT_STEPS de components/marketing/HowItWorks.tsx.
    list: {
      kind: 'step',
      fallback: [
        {
          icon: 'UploadCloud',
          title: 'Envie ou escolha o arquivo 3D',
          text: 'Traga seu STL/3MF ou escolha um dos nossos modelos. A gente ajuda a definir material, cor e acabamento.',
        },
        {
          icon: 'Printer',
          title: 'Imprimimos sob demanda',
          text: 'Impressão de alta precisão com PLA/PETG e acabamento premium, peça por peça, do seu jeito.',
        },
        {
          icon: 'Truck',
          title: 'Entregamos no Brasil todo',
          text: 'Embalagem caprichada e envio para todo o país. Você acompanha cada etapa da produção.',
        },
      ],
    },
  },
  {
    key: 'prova_social',
    label: 'Prova Social (depoimentos)',
    defaults: { eyebrow: 'Depoimentos', title: 'Quem imprime com a gente' },
    // Espelha DEFAULT_TESTIMONIALS de components/marketing/SocialProof.tsx.
    list: {
      kind: 'testimonial',
      fallback: [
        {
          text: 'Peça impecável e chegou rapidíssimo. A Luminária Lua ficou linda na estante!',
          author: 'Marina S.',
          detail: 'Belo Horizonte · MG',
        },
        {
          text: 'Encomendei um action figure personalizado e superou a expectativa. Acabamento premium.',
          author: 'Rafael T.',
          detail: 'São Paulo · SP',
        },
        {
          text: 'Atendimento nota 10 e o protótipo saiu exatamente como pedi. Recomendo demais.',
          author: 'Juliana M.',
          detail: 'Curitiba · PR',
        },
      ],
    },
  },
  {
    key: 'orcamento',
    label: 'Formulário de Orçamento',
    defaults: { eyebrow: 'Peça seu orçamento', title: 'Vamos tirar sua ideia do papel' },
  },
  {
    key: 'newsletter',
    label: 'Newsletter',
    defaults: { title: 'Novidades da GLTech3D' },
  },
  {
    key: 'footer',
    label: 'Rodapé',
    defaults: {
      subtitle:
        'Produtos únicos de impressão 3D feitos com amor e precisão. Do arquivo ao objeto real.',
    },
  },
];

export default function LandingEditClient({
  orgMismatch,
  landingOrgSlug,
  initialProducts,
  initialSettings,
  initialCommissions,
  filaments,
  printers,
  kEnergy,
}: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [settings, setSettings] = useState(initialSettings);
  const [commissions, setCommissions] = useState(initialCommissions);
  const [selectedId, setSelectedId] = useState(initialProducts[0]?.id ?? null);
  const [query, setQuery] = useState('');

  // O autosave pode disparar depois de trocar de peça; o id vai por ref para o
  // patch nunca cair no produto errado.
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const saveProduct = useCallback(async (patch: LandingProductPatch) => {
    const id = selectedIdRef.current;
    if (!id) return { ok: false, error: 'Nenhuma peça selecionada' };
    return updateLandingProduct(id, patch);
  }, []);

  const productSave = useAutosave<LandingProductPatch>({ onSave: saveProduct });

  const saveSettings = useCallback(
    async (patch: { sections?: Record<string, LandingSection>; links?: Record<string, string> }) =>
      updateLandingSettings(patch),
    [],
  );
  const settingsSave = useAutosave<{
    sections?: Record<string, LandingSection>;
    links?: Record<string, string>;
  }>({ onSave: saveSettings });

  function patchLinks(next: Record<string, string>) {
    setSettings((prev) => ({ ...prev, links: next }));
    settingsSave.queue({ links: next });
  }

  const selected = products.find((p) => p.id === selectedId) ?? null;

  const draftCatalog = useMemo(
    () => buildDraftCatalog(products, settings),
    [products, settings],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q),
    );
  }, [products, query]);

  const podium = useMemo(
    () =>
      [1, 2, 3].map((rank) => ({
        rank,
        product: products.find((p) => p.bestsellerRank === rank) ?? null,
      })),
    [products],
  );

  /** Otimista: aplica no estado local na hora e enfileira a gravação. */
  function patchSelected(patch: LandingProductPatch) {
    if (!selectedId) return;
    setProducts((prev) =>
      prev.map((p) => (p.id === selectedId ? { ...p, ...(patch as Partial<LandingProductAdmin>) } : p)),
    );
    productSave.queue(patch);
  }

  async function selectProduct(id: string) {
    // Grava o pendente antes de trocar: senão o patch da peça anterior sairia
    // depois da troca (o ref evita gravar no alvo errado, mas o flush é mais
    // previsível para quem está olhando o indicador).
    await productSave.flush();
    setSelectedId(id);
  }

  async function handleCreate() {
    const result = await createLandingProduct({ name: 'Nova peça', category: '' });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const fresh: LandingProductAdmin = {
      id: result.id,
      slug: null,
      name: 'Nova peça',
      description: null,
      category: null,
      heroCopy: null,
      priceRange: null,
      material: null,
      dimensions: null,
      salePriceCents: null,
      colors: [],
      images: [],
      videos: [],
      links: {},
      isPublished: false,
      isTop: false,
      bestsellerRank: null,
      sortOrder: null,
      stockQty: 0,
      soldQty: 0,
      filamentClientId: null,
      filamentGrams: 0,
      printTimeMinutes: 0,
      printerClientId: null,
      extraCost: 0,
      marginPct: 100,
      pricing: {
        materialCost: 0, energyCost: 0, depreciationCost: 0, extrasCost: 0,
        totalCost: 0, suggestedPrice: 0, profit: 0,
      },
    };
    setProducts((prev) => [fresh, ...prev]);
    setSelectedId(result.id);
    toast.success('Peça criada como rascunho');
  }

  async function handleDelete(id: string) {
    const target = products.find((p) => p.id === id);
    if (!target) return;
    if (!window.confirm(`Excluir "${target.name}" do catálogo? Isso não tem desfazer.`)) return;

    const result = await deleteLandingProduct(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.success('Peça excluída');
  }

  async function handleRank(productId: string, rank: 1 | 2 | 3 | null) {
    const result = await setBestsellerRank({ productId, rank });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // Espelha a regra do servidor: o degrau é exclusivo, quem estava lá sai.
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) return { ...p, bestsellerRank: rank };
        if (rank !== null && p.bestsellerRank === rank) return { ...p, bestsellerRank: null };
        return p;
      }),
    );
  }

  function patchSection(key: string, patch: LandingSection) {
    const nextSections = {
      ...settings.sections,
      [key]: { ...settings.sections[key], ...patch },
    };
    setSettings((prev) => ({ ...prev, sections: nextSections }));
    settingsSave.queue({ sections: nextSections });
  }

  async function saveCommission(platform: string, pct: number) {
    setCommissions((prev) =>
      prev.map((c) => (c.platform === platform ? { ...c, commissionPct: pct } : c)),
    );
    const result = await updatePlatformCommission({ platform, commissionPct: pct });
    if (!result.ok) toast.error(result.error);
  }

  const publishedCount = products.filter((p) => p.isPublished).length;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Landing Edit</h1>
          <p className="text-xs text-muted-foreground">
            {publishedCount} de {products.length} peças publicadas · alterações vão ao ar ao salvar
          </p>
        </div>
        <SaveIndicator
          status={productSave.status === 'idle' ? settingsSave.status : productSave.status}
          error={productSave.error ?? settingsSave.error}
          lastSavedAt={productSave.lastSavedAt ?? settingsSave.lastSavedAt}
        />
      </header>

      {orgMismatch && (
        <div className="flex items-start gap-2 border-b border-warning bg-warning-bg px-6 py-2.5 text-xs text-warning-fg">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Sua organização ativa é <strong>{orgMismatch}</strong>, mas a landing pública serve{' '}
            <strong>{landingOrgSlug}</strong>. As edições aqui <strong>não</strong> aparecerão no
            site. Troque de organização para editar o catálogo publicado.
          </span>
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,460px)_1fr]">
        {/* ── Esquerda: formulários ─────────────────────────────────── */}
        <div className="flex min-h-0 flex-col border-r border-border">
          <Tabs defaultValue="produtos" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 mt-3 grid w-auto grid-cols-6">
              <TabsTrigger value="produtos">Peças</TabsTrigger>
              <TabsTrigger value="podio">Pódio</TabsTrigger>
              <TabsTrigger value="nichos">Nichos</TabsTrigger>
              <TabsTrigger value="textos">Textos</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
              <TabsTrigger value="comissoes">Comissões</TabsTrigger>
            </TabsList>

            {/* Peças */}
            <TabsContent value="produtos" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <div className="sticky top-0 z-10 -mx-4 mb-3 bg-background px-4 pb-2 pt-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar peça…"
                      className="h-9 pl-8"
                    />
                  </div>
                  <Button size="sm" onClick={handleCreate}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Nova
                  </Button>
                </div>
              </div>

              {/* Altura limitada de propósito: com 18 peças, a lista inteira
                  empurrava o editor para fora da tela e dava a impressão de que
                  não dava para editar nada. */}
              <div className="mb-4 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                      p.id === selectedId
                        ? 'border-accent bg-accent-soft'
                        : 'border-transparent hover:bg-muted'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void selectProduct(p.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.name}</span>
                      {p.bestsellerRank && (
                        <Badge variant="secondary" className="shrink-0 gap-0.5 text-[10px]">
                          <Trophy className="h-2.5 w-2.5" />
                          {p.bestsellerRank}º
                        </Badge>
                      )}
                      {!p.isPublished && (
                        <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(p.id)}
                      aria-label={`Excluir ${p.name}`}
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    Nenhuma peça encontrada.
                  </p>
                )}
              </div>

              {selected ? (
                <div className="border-t border-border pt-4">
                  {/* Deixa explícito qual peça está aberta: sem isto, com a lista
                      rolada, não dá para saber o que se está editando. */}
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Editando
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {selected.name}
                    </span>
                    {selected.isPublished ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        No ar
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                        <EyeOff className="h-2.5 w-2.5" />
                        Rascunho
                      </Badge>
                    )}
                  </div>
                  <ProductEditor
                    key={selected.id}
                    product={selected}
                    filaments={filaments}
                    printers={printers}
                    commissions={commissions}
                    kEnergy={kEnergy}
                    onChange={patchSelected}
                    onBlurFlush={() => void productSave.flush()}
                  />
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Selecione uma peça para editar.
                </p>
              )}
            </TabsContent>

            {/* Pódio */}
            <TabsContent value="podio" className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="mb-4 text-xs text-muted-foreground">
                Os três blocos de &quot;Mais Vendidos&quot;. O 1º ocupa o bloco grande; 2º e 3º os
                menores. A quantidade vendida ao lado é o que você lançou em cada peça.
              </p>

              <div className="mb-6 space-y-2">
                {podium.map(({ rank, product }) => (
                  <div key={rank} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant={rank === 1 ? 'default' : 'secondary'} className="gap-1">
                        <Trophy className="h-3 w-3" />
                        {rank}º
                      </Badge>
                      {product && (
                        <span className="text-[11px] text-muted-foreground">
                          {product.soldQty} vendidos
                        </span>
                      )}
                    </div>
                    <Select
                      value={product?.id ?? '__empty'}
                      onValueChange={(v) =>
                        v === '__empty'
                          ? product && void handleRank(product.id, null)
                          : void handleRank(v, rank as 1 | 2 | 3)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha a peça" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty">Deixar vazio</SelectItem>
                        {products
                          .filter((p) => p.isPublished)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} · {p.soldQty} vendidos
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ranking por vendas lançadas
              </h3>
              <p className="mb-2 text-[11px] text-muted-foreground">
                As mais vendidas primeiro. Use os botões <strong>1º / 2º / 3º</strong> para colocar a
                peça direto no pódio.
              </p>
              <div className="space-y-1">
                {[...products]
                  .filter((p) => p.isPublished)
                  .sort((a, b) => b.soldQty - a.soldQty)
                  .slice(0, 8)
                  .map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
                    >
                      <span className="w-4 text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {/* Rotulado: um "0" solto ao lado de botões parecia mais um botão. */}
                      <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                        {p.soldQty} {p.soldQty === 1 ? 'venda' : 'vendas'}
                      </span>
                      {p.bestsellerRank ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge variant="secondary" className="gap-0.5 text-[10px]">
                            <Trophy className="h-2.5 w-2.5" />
                            {p.bestsellerRank}º
                          </Badge>
                          <button
                            type="button"
                            title="Tirar do pódio"
                            onClick={() => void handleRank(p.id, null)}
                            className="rounded p-0.5 text-muted-foreground hover:text-error"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 gap-1">
                          {([1, 2, 3] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              title={`Colocar "${p.name}" em ${r}º no pódio`}
                              onClick={() => void handleRank(p.id, r)}
                              className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
                            >
                              {r}º
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </TabsContent>

            {/* Nichos */}
            <TabsContent value="nichos" className="min-h-0 flex-1 overflow-y-auto p-4">
              <CategoryPanel
                products={products}
                onRenamed={(from, to) =>
                  setProducts((prev) =>
                    prev.map((p) => (p.category === from ? { ...p, category: to } : p)),
                  )
                }
                onReassigned={(from, to) =>
                  setProducts((prev) =>
                    prev.map((p) => (p.category === from ? { ...p, category: to || null } : p)),
                  )
                }
              />
            </TabsContent>

            {/* Textos */}
            <TabsContent value="textos" className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="mb-4 text-xs text-muted-foreground">
                Títulos e subtítulos das seções. Em branco = o texto padrão do site.
              </p>
              <div className="space-y-5">
                {EDITABLE_SECTIONS.map((section) => (
                  <div key={section.key} className="rounded-lg border border-border p-3">
                    <h3 className="mb-3 text-xs font-semibold">{section.label}</h3>
                    <div className="space-y-3">
                      {section.banner && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Imagem de topo (banner)</Label>
                          <BannerPicker
                            value={settings.sections[section.key]?.image}
                            onChange={(image) => {
                              patchSection(section.key, { image });
                              void settingsSave.flush();
                            }}
                          />
                        </div>
                      )}
                      {(['eyebrow', 'title', 'subtitle'] as const).map((field) => {
                        const fallback = section.defaults[field];
                        if (fallback === undefined) return null;
                        const labels = {
                          eyebrow: 'Etiqueta (acima do título)',
                          title: 'Título',
                          subtitle: 'Subtítulo',
                        };
                        return (
                          <div key={field} className="space-y-1.5">
                            <Label htmlFor={`s-${section.key}-${field}`} className="text-xs">
                              {labels[field]}
                            </Label>
                            <Input
                              id={`s-${section.key}-${field}`}
                              value={settings.sections[section.key]?.[field] ?? ''}
                              placeholder={fallback}
                              onChange={(e) => patchSection(section.key, { [field]: e.target.value })}
                              onBlur={() => void settingsSave.flush()}
                            />
                          </div>
                        );
                      })}

                      {section.list && (
                        <div className="border-t border-border pt-3">
                          <SectionItemsEditor
                            kind={section.list.kind}
                            items={settings.sections[section.key]?.items}
                            fallback={section.list.fallback}
                            onChange={(items) => patchSection(section.key, { items })}
                            onBlurFlush={() => void settingsSave.flush()}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Links de plataforma */}
            <TabsContent value="links" className="min-h-0 flex-1 overflow-y-auto p-4">
              <LinksPanel
                links={settings.links}
                products={products}
                onChange={patchLinks}
                onBlurFlush={() => void settingsSave.flush()}
              />
            </TabsContent>

            {/* Comissões */}
            <TabsContent value="comissoes" className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="mb-4 text-xs text-muted-foreground">
                Percentual que cada canal retém sobre o valor de venda. Alimenta o
                &quot;Lucro por canal&quot; de cada peça.
              </p>
              <div className="space-y-2">
                {commissions.map((c) => (
                  <div
                    key={c.platform}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <Label htmlFor={`c-${c.platform}`} className="text-xs font-medium">
                      {c.platform}
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        id={`c-${c.platform}`}
                        inputMode="decimal"
                        defaultValue={String(c.commissionPct)}
                        onBlur={(e) => {
                          const v = Number(e.target.value.replace(',', '.'));
                          const pct = Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
                          if (pct !== c.commissionPct) void saveCommission(c.platform, pct);
                        }}
                        className="h-8 w-20 text-right"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Direita: preview ao vivo ──────────────────────────────── */}
        <div className="hidden min-h-0 lg:block">
          <LivePreview catalog={draftCatalog} />
        </div>
      </div>
    </div>
  );
}
