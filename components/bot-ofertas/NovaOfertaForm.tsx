"use client";

import { useState } from "react";
import { Lightning, FloppyDisk, PaperPlaneTilt } from "@/lib/ui/icons";
import { toast } from "sonner";
import type { OfferItem } from "./types";

export interface NovaOfertaFormData {
  title: string;
  category: string;
  niche?: string;
  marketplace?: string;
  copyStyle?: string;
  originalPrice: string;
  promoPrice: string;
  coupon: string;
  couponHubUrl?: string;
  couponTutorial?: string;
  affiliateUrl: string;
  imageUrl: string;
}

interface Props {
  formData: NovaOfertaFormData;
  setFormData: React.Dispatch<React.SetStateAction<NovaOfertaFormData>>;
  onOfferCreated: (newOffer: OfferItem, dispatchNow?: boolean) => Promise<void>;
  isSubmitting?: boolean;
}

export function NovaOfertaForm({
  formData,
  setFormData,
  onOfferCreated,
  isSubmitting = false,
}: Props) {
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [isScraping, setIsScraping] = useState("");

  const handleScrape = async () => {
    if (!scrapeUrl.trim() || !scrapeUrl.startsWith("http")) {
      toast.error("Informe um link válido começando com http:// ou https://");
      return;
    }

    setIsScraping("Carregando...");
    try {
      const res = await fetch("/api/bot-ofertas/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Não foi possível extrair dados automaticamente");
      }

      const p = data.data;
      setFormData((prev) => ({
        ...prev,
        title: p.title || prev.title,
        imageUrl: p.imageUrl || prev.imageUrl,
        promoPrice: p.promoPrice ? String(p.promoPrice) : prev.promoPrice,
        originalPrice: p.originalPrice ? String(p.originalPrice) : prev.originalPrice,
        coupon: p.coupon || prev.coupon,
        couponTutorial: p.couponTutorial || prev.couponTutorial,
        marketplace: p.marketplace || prev.marketplace || "mercadolivre",
        couponHubUrl: p.couponHubUrl || prev.couponHubUrl || "",
        affiliateUrl: scrapeUrl.trim(),
      }));

      toast.success("Dados puxados com sucesso! Revise e complete os campos.");
      setScrapeUrl("");
    } catch (err: any) {
      toast.error(err.message || "Falha ao puxar dados do link");
    } finally {
      setIsScraping("");
    }
  };

  const handleSubmit = async (dispatchNow = false) => {
    if (!formData.title.trim()) {
      toast.error("Informe o título do produto.");
      return;
    }
    if (!formData.promoPrice || parseFloat(formData.promoPrice) <= 0) {
      toast.error("Informe o preço promocional.");
      return;
    }
    if (!formData.affiliateUrl.trim()) {
      toast.error("Informe o link de afiliado.");
      return;
    }

    try {
      const res = await fetch("/api/bot-ofertas/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title.trim(),
          category: formData.category || "Filamentos 3D",
          niche: formData.niche || "impressao_3d",
          marketplace: formData.marketplace || "mercadolivre",
          copyStyle: formData.copyStyle || "padrao",
          originalPrice: parseFloat(formData.originalPrice) || 0,
          promoPrice: parseFloat(formData.promoPrice),
          coupon: formData.coupon.trim(),
          couponHubUrl: (formData.couponHubUrl || "").trim(),
          couponTutorial: (formData.couponTutorial || "").trim(),
          affiliateUrl: formData.affiliateUrl.trim(),
          imageUrl: formData.imageUrl.trim(),
          status: "pendente",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Erro ao salvar oferta");
      }

      await onOfferCreated(data.offer, dispatchNow);

      // Limpa formulário
      setFormData({
        title: "",
        category: "Filamentos 3D",
        niche: "impressao_3d",
        marketplace: "mercadolivre",
        copyStyle: "padrao",
        originalPrice: "",
        promoPrice: "",
        coupon: "",
        couponHubUrl: "",
        couponTutorial: "",
        affiliateUrl: "",
        imageUrl: "",
      });

      toast.success(
        dispatchNow
          ? "Oferta criada e enviada para disparo!"
          : "Oferta adicionada à fila com sucesso!",
      );
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar oferta");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Bloco Mágico Scraper */}
      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-orange-50/50 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500 text-xs font-black text-white">
              ⚡
            </span>
            <h4 className="text-sm font-bold text-[#2d241e]">Puxar Dados Automáticos do Link (5 Marketplaces)</h4>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-full">
            Mágica
          </span>
        </div>
        <p className="text-xs text-[#6b5e55] mb-3">
          Cole link do Mercado Livre, Shopee, Amazon, AliExpress ou TikTok Shop para extrair título, foto e preço:
        </p>

        <div className="flex gap-2">
          <input
            type="url"
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScrape()}
            placeholder="https://mercadolivre.com/... ou https://sshopee.me/..."
            className="flex-1 rounded-xl border border-[#e8e2d9] bg-white px-3.5 py-2 text-xs text-[#2d241e] placeholder:text-zinc-400 focus:border-[#ea580c] focus:outline-none focus:ring-1 focus:ring-[#ea580c]"
          />
          <button
            type="button"
            disabled={Boolean(isScraping)}
            onClick={handleScrape}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50 shrink-0"
          >
            <Lightning size={14} weight="bold" />
            <span>{isScraping || "Puxar Dados"}</span>
          </button>
        </div>
      </div>

      {/* Formulário Manual / Ajustes */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm space-y-4">
        <div className="border-b border-[#e8e2d9]/60 pb-3">
          <h3 className="text-sm font-bold text-[#2d241e]">Detalhes da Promoção & Copy Maker</h3>
          <p className="text-xs text-[#6b5e55]">Ajuste as informações da oferta que serão disparadas no grupo oficial.</p>
        </div>

        <div className="space-y-3.5">
          {/* Título */}
          <div>
            <label className="block text-xs font-bold text-[#2d241e] mb-1">
              Título do Produto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Filamento PLA 1.75mm Voolt3D 1kg Preto"
              className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none focus:ring-1 focus:ring-[#ea580c]"
            />
          </div>

          {/* Grid Preços */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Preço "DE" (R$)</label>
              <input
                type="number"
                step="0.01"
                value={formData.originalPrice}
                onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                placeholder="Ex: 119.90"
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none focus:ring-1 focus:ring-[#ea580c]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">
                Preço "POR" (R$) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.promoPrice}
                onChange={(e) => setFormData({ ...formData, promoPrice: e.target.value })}
                placeholder="Ex: 79.90"
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs font-bold text-emerald-700 focus:bg-white focus:border-[#ea580c] focus:outline-none focus:ring-1 focus:ring-[#ea580c]"
              />
            </div>
          </div>

          {/* Grid Nicho, Marketplace & Estilo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Nicho / Canal</label>
              <select
                value={formData.niche || "impressao_3d"}
                onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
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
                value={formData.marketplace || "mercadolivre"}
                onChange={(e) => setFormData({ ...formData, marketplace: e.target.value })}
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
                value={formData.copyStyle || "padrao"}
                onChange={(e) => setFormData({ ...formData, copyStyle: e.target.value })}
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              >
                <option value="padrao">🛍️ Padrão Conversão Maker</option>
                <option value="achado">✨ Achado Sensacional!</option>
                <option value="cupom_mes">🔥 Melhor Cupom do Mês</option>
                <option value="urgencia">⚡ Corre que vai esgotar</option>
              </select>
            </div>
          </div>

          {/* Cupom e Hub de Cupons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Cupom de Desconto</label>
              <input
                type="text"
                value={formData.coupon}
                onChange={(e) => setFormData({ ...formData, coupon: e.target.value })}
                placeholder="Ex: 10OFFMAKER"
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs font-mono uppercase text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Central de Cupons (URL)</label>
              <input
                type="url"
                value={formData.couponHubUrl || ""}
                onChange={(e) => setFormData({ ...formData, couponHubUrl: e.target.value })}
                placeholder="https://sshopee.me/GMNE98tfdo4yYUpL"
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              />
            </div>
          </div>

          {/* Link Afiliado */}
          <div>
            <label className="block text-xs font-bold text-[#2d241e] mb-1">
              Link de Afiliado <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              value={formData.affiliateUrl}
              onChange={(e) => setFormData({ ...formData, affiliateUrl: e.target.value })}
              placeholder="https://sshopee.me/... ou https://melila.me/..."
              className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none focus:ring-1 focus:ring-[#ea580c]"
            />
          </div>

          {/* Imagem */}
          <div>
            <label className="block text-xs font-bold text-[#2d241e] mb-1">URL da Imagem do Produto</label>
            <input
              type="url"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              placeholder="https://http2.mlstatic.com/...jpg"
              className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none focus:ring-1 focus:ring-[#ea580c]"
            />
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="pt-2 flex gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(false)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#e8e2d9] bg-white px-4 py-2.5 text-xs font-bold text-[#2d241e] shadow-xs hover:bg-[#faf9f6] transition-colors disabled:opacity-50"
          >
            <FloppyDisk size={16} />
            <span>Salvar na Fila</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(true)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            <PaperPlaneTilt size={16} weight="bold" />
            <span>Disparar Imediato</span>
          </button>
        </div>
      </div>
    </div>
  );
}
