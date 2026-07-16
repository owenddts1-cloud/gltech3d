'use client';

import { ExternalLink, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LandingProductAdmin } from '@/app/actions/landing/actions';

/**
 * Links de plataforma da loja inteira.
 *
 * São o padrão: a peça que não tem link próprio herda daqui. Assim, trocar a URL
 * da Shopee é um campo só — e não editar 18 peças na mão.
 */

const PLATFORMS = [
  { key: 'shopee', label: 'Shopee', placeholder: 'https://shopee.com.br/sua-loja' },
  { key: 'mercadoLivre', label: 'Mercado Livre', placeholder: 'https://mercadolivre.com.br/...' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/5531999999999' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/sua-loja/' },
] as const;

export default function LinksPanel({
  links,
  products,
  onChange,
  onBlurFlush,
}: {
  links: Record<string, string>;
  products: LandingProductAdmin[];
  onChange: (next: Record<string, string>) => void;
  onBlurFlush: () => void;
}) {
  return (
    <div>
      <p className="mb-4 text-xs text-muted-foreground">
        Para onde os botões de compra apontam. Vale para toda a loja; se uma peça tiver link próprio
        (na aba Peças), o dela vence.
      </p>

      <div className="space-y-4">
        {PLATFORMS.map((p) => {
          const overrides = products.filter((prod) => Boolean(prod.links?.[p.key])).length;
          const value = links[p.key] ?? '';
          return (
            <div key={p.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`gl-${p.key}`} className="text-xs">
                  {p.label}
                </Label>
                {value && (
                  <a
                    href={value}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-accent hover:underline"
                  >
                    Testar
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <Input
                id={`gl-${p.key}`}
                placeholder={p.placeholder}
                value={value}
                onChange={(e) => onChange({ ...links, [p.key]: e.target.value })}
                onBlur={onBlurFlush}
              />
              {overrides > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {overrides} {overrides === 1 ? 'peça usa' : 'peças usam'} link próprio e ignora
                  {overrides === 1 ? '' : 'm'} este.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-5 flex items-start gap-1.5 rounded-lg bg-muted px-3 py-2 text-[11px] leading-snug text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        O WhatsApp precisa do formato <code className="font-mono">wa.me/55DDDNÚMERO</code> para abrir
        a conversa direto.
      </p>
    </div>
  );
}
