"use client";

import { useState } from "react";
import { X, FloppyDisk, Sparkle, Tag, LinkSimple, Image as ImageIcon } from "@/lib/ui/icons";
import { toast } from "sonner";
import type { OfferItem, OfferNiche, OfferMarketplace, OfferCopyStyle, OfferStatus } from "./types";

interface Props {
  offer: OfferItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: OfferItem) => Promise<void>;
}

export function EditarOfertaModal({ offer, isOpen, onClose, onSave }: Props) {
  if (!isOpen || !offer) return null;

  const [title, setTitle] = useState(offer.title);
  const [category, setCategory] = useState(offer.category || "Filamentos 3D");
  const [niche, setNiche] = useState<OfferNiche | string>(offer.niche || "impressao_3d");
  const [marketplace, setMarketplace] = useState<OfferMarketplace | string>(offer.marketplace || "mercadolivre");
  const [copyStyle, setCopyStyle] = useState<OfferCopyStyle | string>(offer.copyStyle || "padrao");
  const [originalPrice, setOriginalPrice] = useState(String(offer.originalPrice || ""));
  const [promoPrice, setPromoPrice] = useState(String(offer.promoPrice || ""));
  const [coupon, setCoupon] = useState(offer.coupon || "");
  const [couponHubUrl, setCouponHubUrl] = useState(offer.couponHubUrl || "");
  const [affiliateUrl, setAffiliateUrl] = useState(offer.affiliateUrl || "");
  const [imageUrl, setImageUrl] = useState(offer.imageUrl || "");
  const [status, setStatus] = useState<OfferStatus>(offer.status || "pendente");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("O título do produto é obrigatório.");
      return;
    }
    if (!promoPrice || parseFloat(promoPrice) <= 0) {
      toast.error("O preço promocional é obrigatório.");
      return;
    }

    setIsSaving(true);
    try {
      const updated: OfferItem = {
        ...offer,
        title: title.trim(),
        category: category.trim(),
        niche,
        marketplace,
        copyStyle,
        originalPrice: parseFloat(originalPrice) || 0,
        promoPrice: parseFloat(promoPrice) || 0,
        coupon: coupon.trim(),
        couponHubUrl: couponHubUrl.trim(),
        affiliateUrl: affiliateUrl.trim(),
        imageUrl: imageUrl.trim(),
        status,
      };

      await onSave(updated);
      toast.success("Oferta atualizada com sucesso!");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar alterações da oferta");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#e8e2d9] bg-white p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e8e2d9]/80 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-800 text-sm font-black">
              ✏️
            </span>
            <div>
              <h3 className="text-base font-bold text-[#2d241e]">Editar Anúncio da Oferta</h3>
              <p className="text-xs text-[#6b5e55]">Edição individual completa da copy, nicho, marketplace e valores</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-bold text-[#2d241e] mb-1">
              Título do Produto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
            />
          </div>

          {/* Grid Preços */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Preço "DE" (R$)</label>
              <input
                type="number"
                step="0.01"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">
                Preço "POR" (R$) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs font-bold text-emerald-700 focus:bg-white focus:border-[#ea580c] focus:outline-none"
              />
            </div>
          </div>

          {/* Grid Nicho, Marketplace & Estilo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Nicho / Tema</label>
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              >
                <option value="impressao_3d">🧵 Impressão 3D & Filamentos</option>
                <option value="ferramentas">🔧 Kits de Ferramentas Maker</option>
                <option value="eletronicos">💡 Eletrônicos & Smart Home</option>
                <option value="geral">📦 Geral</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Marketplace</label>
              <select
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              >
                <option value="mercadolivre">🟡 Mercado Livre</option>
                <option value="shopee">🟠 Shopee</option>
                <option value="amazon">🔵 Amazon</option>
                <option value="aliexpress">🔴 AliExpress</option>
                <option value="tiktok">⚫ TikTok Shop</option>
                <option value="outro">⚪ Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Estilo de Copy</label>
              <select
                value={copyStyle}
                onChange={(e) => setCopyStyle(e.target.value)}
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              >
                <option value="padrao">🛍️ Padrão Conversão Maker</option>
                <option value="achado">✨ Achado Sensacional!</option>
                <option value="cupom_mes">🔥 Melhor Cupom do Mês</option>
                <option value="urgencia">⚡ Corre que vai esgotar</option>
              </select>
            </div>
          </div>

          {/* Grid Cupom e Central de Cupons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Cupom de Desconto</label>
              <input
                type="text"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="Ex: 10OFFMAKER"
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs uppercase font-mono text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Link da Central de Cupons</label>
              <input
                type="url"
                value={couponHubUrl}
                onChange={(e) => setCouponHubUrl(e.target.value)}
                placeholder="https://shopee.com.br/m/cupons-diarios"
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              />
            </div>
          </div>

          {/* Link Afiliado */}
          <div>
            <label className="block text-xs font-bold text-[#2d241e] mb-1">Link de Afiliado</label>
            <input
              type="url"
              value={affiliateUrl}
              onChange={(e) => setAffiliateUrl(e.target.value)}
              className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs font-mono text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
            />
          </div>

          {/* Imagem e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">URL da Imagem</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Status do Anúncio</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OfferStatus)}
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              >
                <option value="pendente">⏳ Pendente na Fila</option>
                <option value="enviado">✅ Enviado (Ativo p/ Rodízio)</option>
                <option value="pausado">⏸️ Pausado</option>
                <option value="esgotado">🛑 Esgotado</option>
              </select>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#e8e2d9]/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#e8e2d9] bg-white px-4 py-2 text-xs font-semibold text-[#2d241e] hover:bg-[#faf9f6] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white px-5 py-2 text-xs font-bold shadow-md shadow-orange-500/20 hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              <FloppyDisk size={14} />
              <span>{isSaving ? "Salvando..." : "Salvar Alterações"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
