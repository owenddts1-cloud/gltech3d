'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TriangleAlert } from 'lucide-react';
import { computeProductPricing } from '@/lib/pricing/engine';
import type { LandingProductAdmin, PlatformCommission } from '@/app/actions/landing/actions';
import type { LandingProductPatch } from '@/lib/schemas/landing-edit';
import MediaGallery from './MediaGallery';

const brl = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  product: LandingProductAdmin;
  filaments: { id: string; name: string; costPerGram: number }[];
  printers: { id: string; name: string }[];
  commissions: PlatformCommission[];
  kEnergy: number;
  onChange: (patch: LandingProductPatch) => void;
  onBlurFlush: () => void;
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

export default function ProductEditor({
  product,
  filaments,
  printers,
  commissions,
  kEnergy,
  onChange,
  onBlurFlush,
}: Props) {
  const salePrice = (product.salePriceCents ?? 0) / 100;

  // Recalcula no cliente enquanto digita — o servidor recalcula ao gravar; os
  // dois usam o mesmo `computeProductPricing`, então não divergem.
  const pricing = useMemo(() => {
    const fil = filaments.find((f) => f.id === product.filamentClientId);
    return computeProductPricing({
      filamentGrams: product.filamentGrams,
      costPerGram: fil?.costPerGram ?? 0,
      printTimeSeconds: product.printTimeMinutes * 60,
      kEnergy,
      extraCostCents: Math.round(product.extraCost * 100),
      marginPct: product.marginPct,
    });
  }, [product, filaments, kEnergy]);

  // Lucro real por canal: o marketplace tira a comissão do PREÇO DE VENDA.
  const perPlatform = useMemo(
    () =>
      commissions.map((c) => {
        const fee = salePrice * (c.commissionPct / 100);
        const profit = salePrice - pricing.totalCost - fee;
        const marginPct = salePrice > 0 ? (profit / salePrice) * 100 : 0;
        return { ...c, fee, profit, marginPct };
      }),
    [commissions, salePrice, pricing.totalCost],
  );

  const noPrice = salePrice <= 0;

  return (
    <div className="space-y-6 pb-8">
      <section>
        <SectionTitle>Identificação</SectionTitle>
        <div className="space-y-3">
          <Field label="Nome do produto" htmlFor="f-name">
            <Input
              id="f-name"
              value={product.name}
              onChange={(e) => onChange({ name: e.target.value })}
              onBlur={onBlurFlush}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria (nicho)" htmlFor="f-cat">
              <Input
                id="f-cat"
                value={product.category ?? ''}
                onChange={(e) => onChange({ category: e.target.value })}
                onBlur={onBlurFlush}
              />
            </Field>
            <Field label="Slug (URL)" htmlFor="f-slug" hint={`/product/${product.slug ?? ''}`}>
              <Input
                id="f-slug"
                value={product.slug ?? ''}
                onChange={(e) => onChange({ slug: e.target.value })}
                onBlur={onBlurFlush}
              />
            </Field>
          </div>
          <Field label="Descrição (aparece no card)" htmlFor="f-desc">
            <Textarea
              id="f-desc"
              rows={3}
              value={product.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              onBlur={onBlurFlush}
            />
          </Field>
          <Field
            label="Texto do bloco campeão"
            htmlFor="f-hero"
            hint="Só aparece na peça que estiver em 1º no pódio. Vazio = usa a descrição."
          >
            <Textarea
              id="f-hero"
              rows={3}
              value={product.heroCopy ?? ''}
              onChange={(e) => onChange({ heroCopy: e.target.value })}
              onBlur={onBlurFlush}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle>Vitrine</SectionTitle>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <div className="text-xs font-medium">Publicado na landing</div>
              <div className="text-[11px] text-muted-foreground">
                {product.isPublished ? 'Visível para o cliente' : 'Rascunho, invisível no site'}
              </div>
            </div>
            <Switch
              checked={product.isPublished}
              disabled={noPrice && !product.isPublished}
              onCheckedChange={(v) => {
                onChange({ isPublished: v });
                onBlurFlush();
              }}
            />
          </div>
          {noPrice && (
            <p className="flex items-start gap-1.5 text-[11px] text-warning-fg">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
              Defina o valor de venda para poder publicar.
            </p>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div className="text-xs font-medium">Selo &quot;Destaque&quot; no card</div>
            <Switch
              checked={product.isTop}
              onCheckedChange={(v) => {
                onChange({ isTop: v });
                onBlurFlush();
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Material" htmlFor="f-mat">
              <Input
                id="f-mat"
                value={product.material ?? ''}
                onChange={(e) => onChange({ material: e.target.value })}
                onBlur={onBlurFlush}
              />
            </Field>
            <Field label="Dimensões" htmlFor="f-dim">
              <Input
                id="f-dim"
                value={product.dimensions ?? ''}
                onChange={(e) => onChange({ dimensions: e.target.value })}
                onBlur={onBlurFlush}
              />
            </Field>
          </div>
          <Field
            label="Cores"
            htmlFor="f-colors"
            hint="Separe por vírgula. Ex.: Branco, Preto, Colorido"
          >
            <Input
              id="f-colors"
              value={product.colors.join(', ')}
              onChange={(e) =>
                onChange({
                  colors: e.target.value
                    .split(',')
                    .map((c) => c.trim())
                    .filter(Boolean),
                })
              }
              onBlur={onBlurFlush}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle>Fotos e vídeos</SectionTitle>
        <MediaGallery
          images={product.images}
          videos={product.videos}
          onChangeImages={(images) => {
            onChange({ images });
            onBlurFlush();
          }}
          onChangeVideos={(videos) => {
            onChange({ videos });
            onBlurFlush();
          }}
        />
      </section>

      <section>
        <SectionTitle>Preço e estoque</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Valor de venda (R$)" htmlFor="f-price">
            <Input
              id="f-price"
              inputMode="decimal"
              value={salePrice ? String(salePrice) : ''}
              onChange={(e) => {
                const v = Number(e.target.value.replace(',', '.'));
                onChange({ salePriceCents: Number.isFinite(v) ? Math.round(v * 100) : 0 });
              }}
              onBlur={onBlurFlush}
            />
          </Field>
          <Field label="Em estoque" htmlFor="f-stock">
            <Input
              id="f-stock"
              inputMode="numeric"
              value={String(product.stockQty)}
              onChange={(e) => onChange({ stockQty: Number(e.target.value) || 0 })}
              onBlur={onBlurFlush}
            />
          </Field>
          <Field label="Vendidos" htmlFor="f-sold" hint="Alimenta a ordem do pódio.">
            <Input
              id="f-sold"
              inputMode="numeric"
              value={String(product.soldQty)}
              onChange={(e) => onChange({ soldQty: Number(e.target.value) || 0 })}
              onBlur={onBlurFlush}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field
            label="Faixa de preço (opcional)"
            htmlFor="f-range"
            hint='Para peças com variação. Ex.: "16,90 - 32,90". Se preenchido, o card mostra a faixa.'
          >
            <Input
              id="f-range"
              value={product.priceRange ?? ''}
              onChange={(e) => onChange({ priceRange: e.target.value })}
              onBlur={onBlurFlush}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle>Custo de manufatura</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Filamento" htmlFor="f-fil">
            <Select
              value={product.filamentClientId ?? '__none'}
              onValueChange={(v) => {
                onChange({ filamentClientId: v === '__none' ? null : v });
                onBlurFlush();
              }}
            >
              <SelectTrigger id="f-fil">
                <SelectValue placeholder="Selecione o filamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhum</SelectItem>
                {filaments.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} ({brl(f.costPerGram)}/g)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Impressora (depreciação)" htmlFor="f-prn">
            <Select
              value={product.printerClientId ?? '__none'}
              onValueChange={(v) => {
                onChange({ printerClientId: v === '__none' ? null : v });
                onBlurFlush();
              }}
            >
              <SelectTrigger id="f-prn">
                <SelectValue placeholder="Selecione a impressora" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhuma</SelectItem>
                {printers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Filamento gasto (g)" htmlFor="f-grams">
            <Input
              id="f-grams"
              inputMode="decimal"
              value={String(product.filamentGrams)}
              onChange={(e) => onChange({ filamentGrams: Number(e.target.value.replace(',', '.')) || 0 })}
              onBlur={onBlurFlush}
            />
          </Field>
          <Field label="Tempo de impressão (min)" htmlFor="f-time">
            <Input
              id="f-time"
              inputMode="numeric"
              value={String(product.printTimeMinutes)}
              onChange={(e) => onChange({ printTimeMinutes: Number(e.target.value) || 0 })}
              onBlur={onBlurFlush}
            />
          </Field>
          <Field label="Insumos extras (R$)" htmlFor="f-extra" hint="Embalagem, ímã, tag…">
            <Input
              id="f-extra"
              inputMode="decimal"
              value={String(product.extraCost)}
              onChange={(e) => onChange({ extraCost: Number(e.target.value.replace(',', '.')) || 0 })}
              onBlur={onBlurFlush}
            />
          </Field>
          <Field label="Margem alvo (%)" htmlFor="f-margin" hint="Só sugere preço; não sobrescreve.">
            <Input
              id="f-margin"
              inputMode="decimal"
              value={String(product.marginPct)}
              onChange={(e) => onChange({ marginPct: Number(e.target.value.replace(',', '.')) || 0 })}
              onBlur={onBlurFlush}
            />
          </Field>
        </div>

        <div className="mt-4 space-y-1.5 rounded-lg bg-muted/60 p-3 text-xs">
          <Row label="Material" value={brl(pricing.materialCost)} />
          <Row label={`Energia (${brl(kEnergy)}/kWh)`} value={brl(pricing.energyCost)} />
          <Row label="Depreciação" value={brl(pricing.depreciationCost)} />
          <Row label="Insumos" value={brl(pricing.extrasCost)} />
          <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 font-semibold">
            <span>Custo unitário</span>
            <span>{brl(pricing.totalCost)}</span>
          </div>
          <Row label={`Preço sugerido (${product.marginPct}% margem)`} value={brl(pricing.suggestedPrice)} />
        </div>
      </section>

      <section>
        <SectionTitle>Lucro por canal</SectionTitle>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Comissão descontada do valor de venda. Ajuste os percentuais na aba Comissões.
        </p>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Canal</th>
                <th className="px-3 py-2 text-right font-medium">Comissão</th>
                <th className="px-3 py-2 text-right font-medium">Lucro</th>
                <th className="px-3 py-2 text-right font-medium">Margem</th>
              </tr>
            </thead>
            <tbody>
              {perPlatform.map((p) => (
                <tr key={p.platform} className="border-t border-border">
                  <td className="px-3 py-2">{p.platform}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {p.commissionPct}%{p.fee > 0 && ` · ${brl(p.fee)}`}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      p.profit < 0 ? 'text-error' : ''
                    }`}
                  >
                    {brl(p.profit)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {p.profit < 0 ? (
                      <Badge variant="destructive" className="text-[10px]">
                        prejuízo
                      </Badge>
                    ) : (
                      `${p.marginPct.toFixed(0)}%`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle>Links de compra</SectionTitle>
        <div className="space-y-3">
          {(
            [
              ['shopee', 'Shopee'],
              ['mercadoLivre', 'Mercado Livre'],
              ['whatsapp', 'WhatsApp'],
              ['instagram', 'Instagram'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label} htmlFor={`f-link-${key}`}>
              <Input
                id={`f-link-${key}`}
                placeholder="https://…"
                value={product.links[key] ?? ''}
                onChange={(e) => onChange({ links: { ...product.links, [key]: e.target.value } })}
                onBlur={onBlurFlush}
              />
            </Field>
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
