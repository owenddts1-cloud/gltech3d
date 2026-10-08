'use client';

import { useState } from 'react';
import { priceLabelWithoutSymbol } from "@/lib/format/money";
import Link from 'next/link';
import { ShoppingBag, X, ExternalLink, Trophy, PackageCheck } from 'lucide-react';
import type { LandingProduct } from '@/lib/landing/types';
import { storeWhatsappUrl } from '@/lib/landing/whatsapp-number';
import { track } from '@/lib/analytics/track';

/**
 * Ready-to-ship stock worth showing. Pieces are printed on demand, so a low
 * stock is NOT "últimas unidades" — it is how many ship right away. Only real
 * data (stock_qty 1..3); 0 shows nothing (it can still be printed).
 */
function readyStockLabel(stockQty: number): string | null {
  if (!Number.isInteger(stockQty) || stockQty < 1 || stockQty > 3) return null;
  return stockQty === 1 ? 'Só 1 a pronta entrega' : `Só ${stockQty} a pronta entrega`;
}

export default function ProductActions({
  product,
  storeWhatsapp,
}: {
  product: LandingProduct;
  /** Store WhatsApp digits (lib/landing/whatsapp.ts), resolved by the server page. */
  storeWhatsapp: string;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const defaultWaUrl = storeWhatsappUrl(storeWhatsapp, `Olá! Quero pedir o produto: ${product.name}`);
  const waLink = product.links?.whatsapp || defaultWaUrl;
  const readyStock = readyStockLabel(product.stockQty);
  const trackWhatsapp = (origem: string) => track('click_whatsapp', { origem, produto: product.name });

  return (
    <>
      <div className="p-6 rounded-3xl bg-white border border-[#E8E2D9] shadow-sm">
        {product.bestsellerRank || readyStock ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {product.bestsellerRank ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2B2622] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#E0C4A0]">
                <Trophy className="h-3 w-3" />
                Mais vendido
              </span>
            ) : null}
            {readyStock ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EED6A8] bg-[#FBEFD9] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7A4E12]">
                <PackageCheck className="h-3 w-3" />
                {readyStock}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="text-[10px] text-[#6B5E55] uppercase tracking-wider font-bold mb-1">Preço</div>
            <div className="text-4xl font-bold font-sora">
              R$ {priceLabelWithoutSymbol(product.price, product.priceRange)}
            </div>
          </div>
          <div className="text-[10px] text-[#6B5E55] text-right font-medium">
            Envio para todo<br/>o Brasil
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              track('click_comprar', { origem: 'pagina_produto', produto: product.name });
              setIsModalOpen(true);
            }}
            className="w-full py-4 bg-[#8E6D4D] hover:bg-[#6F5439] transition-colors text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md"
          >
            <ShoppingBag className="w-5 h-5" />
            Comprar Agora
          </button>
          
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsapp('produto')}
            className="w-full py-3 bg-[#25D366] hover:bg-[#1EBE5A] transition-colors text-white rounded-2xl font-bold flex items-center justify-center gap-2 text-xs"
          >
            Pedir pelo WhatsApp
          </a>
        </div>

        <div className="mt-4 text-center text-[10px] text-[#6B5E55]">
          Shopee • Mercado Livre • WhatsApp • Instagram
        </div>

        <p className="mt-5 border-t border-[#E8E2D9] pt-4 text-center text-xs leading-relaxed text-[#6B5E55]">
          Também imprime em casa? O filamento que usamos está à venda, testado na nossa produção.{' '}
          <Link
            href="/filamentos"
            onClick={() => track('click_filamento', { origem: 'pagina_produto', produto: product.name })}
            className="font-bold text-[#7A5C3E] underline-offset-4 hover:underline"
          >
            Ver cores →
          </Link>
        </p>
      </div>

      {/* Buy Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-md relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#F9F7F2] hover:bg-[#E8E2D9] transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-6">
              <div className="text-[10px] text-[#A6815C] uppercase tracking-wider font-bold mb-1">Onde Comprar</div>
              <h3 className="text-xl font-bold font-sora">{product.name}</h3>
              <div className="text-lg font-bold text-[#6B5E55] mt-1">R$ {priceLabelWithoutSymbol(product.price, product.priceRange)}</div>
            </div>

            <div className="space-y-3">
              {product.links?.shopee && (
                <a href={product.links.shopee} target="_blank" rel="noopener noreferrer" onClick={() => track('click_marketplace', { canal: 'shopee', produto: product.name })} className="flex items-center justify-between p-4 rounded-2xl border border-[#E8E2D9] hover:border-[#A6815C] hover:bg-[#F9F7F2] transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EE4D2D] flex items-center justify-center text-white font-bold text-xs">SH</div>
                    <div>
                      <div className="font-bold text-sm">Shopee</div>
                      <div className="text-[10px] text-[#6B5E55]">Comprar na Shopee</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#A6815C] opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              )}

              {product.links?.mercadoLivre && (
                <a href={product.links.mercadoLivre} target="_blank" rel="noopener noreferrer" onClick={() => track('click_marketplace', { canal: 'mercado_livre', produto: product.name })} className="flex items-center justify-between p-4 rounded-2xl border border-[#E8E2D9] hover:border-[#A6815C] hover:bg-[#F9F7F2] transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFE600] flex items-center justify-center text-[#2D241E] font-bold text-xs">ML</div>
                    <div>
                      <div className="font-bold text-sm">Mercado Livre</div>
                      <div className="text-[10px] text-[#6B5E55]">Comprar no ML</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#A6815C] opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              )}

              <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsapp('produto_modal')} className="flex items-center justify-between p-4 rounded-2xl border border-[#E8E2D9] hover:border-[#A6815C] hover:bg-[#F9F7F2] transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center text-white font-bold text-xs">WA</div>
                  <div>
                    <div className="font-bold text-sm">WhatsApp Direct</div>
                    <div className="text-[10px] text-[#6B5E55]">Falar com Vendedor</div>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-[#A6815C] opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>

              {product.links?.instagram && (
                <a href={product.links.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-2xl border border-[#E8E2D9] hover:border-[#A6815C] hover:bg-[#F9F7F2] transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E1306C] flex items-center justify-center text-white font-bold text-xs">IG</div>
                    <div>
                      <div className="font-bold text-sm">Instagram</div>
                      <div className="text-[10px] text-[#6B5E55]">Ver no Instagram</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#A6815C] opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
