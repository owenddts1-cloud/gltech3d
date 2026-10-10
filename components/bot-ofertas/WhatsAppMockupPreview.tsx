"use client";

import { useState } from "react";
import { formatCurrency, calculateDiscount, formatOfferMessage } from "@/lib/bot-engine/formatter";
import { Copy, PaperPlaneTilt, Check, ImageIcon } from "@/lib/ui/icons";
import { toast } from "sonner";

interface Props {
  offer: {
    title: string;
    originalPrice: number | string;
    promoPrice: number | string;
    coupon: string;
    affiliateUrl: string;
    imageUrl: string;
  };
  groupName?: string;
  groupInviteUrl?: string;
  defaultHashtags?: string;
  watermarkText?: string;
  onDispatch?: () => void;
  isDispatching?: boolean;
}

export function WhatsAppMockupPreview({
  offer,
  groupName = "Tech Ofertas - Impressão 3D",
  groupInviteUrl = "",
  defaultHashtags = "#anúncio #cacadoresderenda #GLTech3D",
  watermarkText = "GLTech3D",
  onDispatch,
  isDispatching = false,
}: Props) {
  const [copied, setCopied] = useState(false);

  const discount = calculateDiscount(offer.originalPrice, offer.promoPrice);
  const formattedText = formatOfferMessage(offer, {
    groupInviteUrl,
    defaultHashtags,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedText);
    setCopied(true);
    toast.success("Texto da oferta copiado com sucesso!");
    setTimeout(() => setCopied(false), 2000);
  };

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#2d241e] flex items-center gap-2">
          <span>📱</span> Preview Real no WhatsApp
        </h3>
        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          Tempo Real
        </span>
      </div>

      {/* Mockup Frame do Smartphone */}
      <div className="relative mx-auto w-full max-w-sm rounded-[2.2rem] border-4 border-[#2d241e] bg-[#0b141a] p-3 shadow-2xl overflow-hidden text-zinc-100">
        {/* Notch / Speaker */}
        <div className="mx-auto mb-2.5 h-3.5 w-24 rounded-full bg-zinc-900 flex items-center justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-700 mr-2" />
          <div className="h-1 w-8 rounded-full bg-zinc-700" />
        </div>

        {/* Header do WhatsApp */}
        <div className="flex items-center gap-2.5 border-b border-[#202c33] bg-[#1f2c34] px-3 py-2 rounded-t-xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shrink-0">
            3D
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-zinc-100 leading-tight">
              {groupName || "Grupo de Ofertas Maker 3D"}
            </p>
            <p className="text-[10px] text-zinc-400">mensagens do bot de ofertas</p>
          </div>
        </div>

        {/* Chat Canvas com Wallpaper WhatsApp */}
        <div
          className="min-h-[380px] p-2.5 flex flex-col justify-end"
          style={{
            backgroundColor: "#0b141a",
            backgroundImage:
              "radial-gradient(#1f2c34 1px, transparent 1px), radial-gradient(#1f2c34 1px, #0b141a 1px)",
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 10px 10px",
          }}
        >
          {/* Balão de Mensagem estilo WhatsApp */}
          <div className="relative max-w-[92%] self-start rounded-2xl rounded-tl-sm bg-[#202c33] p-2.5 shadow-md border border-[#2a3942]/60">
            {/* Imagem do Produto com Marca D'água */}
            {offer.imageUrl ? (
              <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 border border-zinc-700/40">
                <img
                  src={offer.imageUrl}
                  alt={offer.title || "Oferta"}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // Fallback se imagem quebrar
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                {/* Marca d'água oficial GLTech3D */}
                <div className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-[#fdba74] backdrop-blur-xs">
                  {watermarkText}
                </div>
              </div>
            ) : (
              <div className="mb-2 flex aspect-video w-full flex-col items-center justify-center rounded-xl bg-zinc-800/60 text-zinc-500 border border-dashed border-zinc-700">
                <ImageIcon size={28} className="opacity-50" />
                <span className="mt-1 text-[11px]">Cole a URL da foto ou use o Scraper</span>
              </div>
            )}

            {/* Texto da Mensagem */}
            <div className="space-y-1 text-xs leading-relaxed text-zinc-200">
              <p className="font-bold text-white break-words">
                🛍️ {offer.title || "Título do Produto"}
              </p>

              {Number(offer.originalPrice) > Number(offer.promoPrice) && Number(offer.promoPrice) > 0 ? (
                <div className="pt-0.5">
                  <p className="text-[11px] text-zinc-400 line-through">
                    De: R$ {formatCurrency(offer.originalPrice)}
                  </p>
                  <p className="font-bold text-emerald-400 text-sm">
                    Por: R$ {formatCurrency(offer.promoPrice)} ✅
                    {discount > 0 ? ` (${discount}% OFF)` : ""}
                  </p>
                </div>
              ) : Number(offer.promoPrice) > 0 ? (
                <p className="font-bold text-emerald-400 text-sm">
                  Por: R$ {formatCurrency(offer.promoPrice)} ✅
                </p>
              ) : null}

              {offer.coupon?.trim() && (
                <p className="font-semibold text-amber-300">
                  🎟️ {offer.coupon.toLowerCase().includes("cupom") ? offer.coupon : `Use o cupom ${offer.coupon}`}
                </p>
              )}

              {offer.affiliateUrl?.trim() && (
                <p className="text-cyan-400 underline break-all font-mono text-[11px] pt-1">
                  🛒 {offer.affiliateUrl}
                </p>
              )}

              {groupInviteUrl?.trim() && (
                <p className="text-zinc-400 text-[10px] pt-1">
                  🚀 Entre no grupo: <span className="text-cyan-400 underline">{groupInviteUrl}</span>
                </p>
              )}

              <p className="text-[10px] text-zinc-500 pt-1">
                {defaultHashtags}
              </p>
            </div>

            {/* Timestamp e Status Checkmarks */}
            <div className="mt-1.5 flex items-center justify-end gap-1 text-[9px] text-zinc-400">
              <span>{timeStr}</span>
              <span className="text-cyan-400">✓✓</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ações rápidas abaixo do Mockup */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#e8e2d9] bg-white px-3 py-2 text-xs font-semibold text-[#2d241e] shadow-xs hover:bg-[#faf9f6] transition-colors"
        >
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          <span>{copied ? "Copiado!" : "Copiar Texto"}</span>
        </button>

        {onDispatch && (
          <button
            type="button"
            disabled={isDispatching || !offer.title || !offer.promoPrice}
            onClick={onDispatch}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] px-3 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:opacity-95 transition-all disabled:opacity-50"
          >
            <PaperPlaneTilt size={14} weight="bold" />
            <span>{isDispatching ? "Disparando..." : "Disparar Agora 🚀"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
