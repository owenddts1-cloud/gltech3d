'use client';

import { useState } from 'react';
import { ShoppingBag, X, ExternalLink } from 'lucide-react';
import type { LandingProduct } from '@/lib/landing/types';

export default function ProductActions({ product }: { product: LandingProduct }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="p-6 rounded-3xl bg-white border border-[#E8E2D9] shadow-sm">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="text-[10px] text-[#6B5E55] uppercase tracking-wider font-bold mb-1">Preço</div>
            <div className="text-4xl font-bold font-sora">R$ {product.priceRange ? product.priceRange : product.price.toFixed(2)}</div>
          </div>
          <div className="text-[10px] text-[#6B5E55] text-right">
            Frete calculado<br/>no checkout
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full py-4 bg-[#A6815C] hover:bg-[#8E6D4D] transition-colors text-white rounded-2xl font-bold flex items-center justify-center gap-2"
        >
          <ShoppingBag className="w-5 h-5" />
          Comprar Agora
        </button>

        <div className="mt-4 text-center text-[10px] text-[#6B5E55]">
          Shopee • Mercado Livre • WhatsApp • Instagram
        </div>
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
              <div className="text-lg font-bold text-[#6B5E55] mt-1">R$ {product.priceRange ? product.priceRange : product.price.toFixed(2)}</div>
            </div>

            <div className="space-y-3">
              {product.links?.shopee && (
                <a href={product.links.shopee} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-2xl border border-[#E8E2D9] hover:border-[#A6815C] hover:bg-[#F9F7F2] transition-colors group">
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
                <a href={product.links.mercadoLivre} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-2xl border border-[#E8E2D9] hover:border-[#A6815C] hover:bg-[#F9F7F2] transition-colors group">
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

              {product.links?.whatsapp && (
                <a href={product.links.whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-2xl border border-[#E8E2D9] hover:border-[#A6815C] hover:bg-[#F9F7F2] transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center text-white font-bold text-xs">WA</div>
                    <div>
                      <div className="font-bold text-sm">WhatsApp</div>
                      <div className="text-[10px] text-[#6B5E55]">Falar com Vendedor</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#A6815C] opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              )}

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
