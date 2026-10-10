"use client";

import { useState } from "react";
import {
  MagnifyingGlass,
  PaperPlaneTilt,
  Trash,
  PencilSimple,
  DownloadSimple,
  UploadSimple,
  CheckCircle,
  Clock,
  ArrowsClockwise,
  PauseCircle,
  XCircle,
} from "@/lib/ui/icons";
import { formatCurrency, calculateDiscount } from "@/lib/bot-engine/formatter";
import { toast } from "sonner";
import type { OfferItem, OfferStatus } from "./types";

interface Props {
  offers: OfferItem[];
  onDispatch: (offer: OfferItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (offer: OfferItem) => void;
  onRefresh: () => Promise<void>;
}

export function PlanilhaFilaTable({ offers, onDispatch, onDelete, onEdit, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [nicheFilter, setNicheFilter] = useState<string>("todos");
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [refreshingPriceId, setRefreshingPriceId] = useState<string | null>(null);

  const filtered = offers.filter((o) => {
    const matchesSearch =
      o.title.toLowerCase().includes(search.toLowerCase()) ||
      o.category.toLowerCase().includes(search.toLowerCase()) ||
      (o.coupon && o.coupon.toLowerCase().includes(search.toLowerCase()));

    const matchesNiche = nicheFilter === "todos" || o.niche === nicheFilter;
    const matchesMarketplace = marketplaceFilter === "todos" || o.marketplace === marketplaceFilter;
    const matchesStatus = statusFilter === "todos" || o.status === statusFilter;

    return matchesSearch && matchesNiche && matchesMarketplace && matchesStatus;
  });

  const handleRefreshPrice = async (offer: OfferItem) => {
    setRefreshingPriceId(offer.id);
    try {
      const res = await fetch(`/api/bot-ofertas/offers/${offer.id}/refresh`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Não foi possível atualizar o preço");
      }
      toast.success(
        data.updatedPrice
          ? `Preço atualizado para R$ ${formatCurrency(data.updatedPrice)}!`
          : "Preço verificado e mantido sem alterações na loja.",
      );
      await onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erro ao consultar loja parceira");
    } finally {
      setRefreshingPriceId(null);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "ID",
      "Título",
      "Categoria",
      "Nicho",
      "Marketplace",
      "Preço De",
      "Preço Por",
      "Cupom",
      "Central Cupons",
      "Link Afiliado",
      "URL Imagem",
      "Status",
      "Reciclagens",
    ];
    const rows = offers.map((o) => [
      o.id,
      `"${o.title.replace(/"/g, '""')}"`,
      `"${o.category}"`,
      `"${o.niche || "impressao_3d"}"`,
      `"${o.marketplace || "mercadolivre"}"`,
      o.originalPrice,
      o.promoPrice,
      `"${o.coupon || ""}"`,
      `"${o.couponHubUrl || ""}"`,
      `"${o.affiliateUrl}"`,
      `"${o.imageUrl}"`,
      o.status,
      o.recycledCount || 0,
    ]);

    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ofertas_gltech3d_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Arquivo CSV exportado com sucesso!");
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          toast.error("O arquivo CSV está vazio ou contém apenas o cabeçalho.");
          return;
        }

        const separator = lines[0].includes(";") ? ";" : ",";
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          const cols = line.split(separator).map((c) => c.replace(/^"|"$/g, "").trim());
          if (cols.length >= 5) {
            await fetch("/api/bot-ofertas/offers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: cols[1] || cols[0] || "Oferta Importada",
                category: cols[2] || "Filamentos 3D",
                niche: cols[3] || "impressao_3d",
                marketplace: cols[4] || "mercadolivre",
                originalPrice: parseFloat(cols[5] || "0") || 0,
                promoPrice: parseFloat(cols[6] || "0") || 0,
                coupon: cols[7] || "",
                couponHubUrl: cols[8] || "",
                affiliateUrl: cols[9] || "",
                imageUrl: cols[10] || "",
                status: "pendente",
              }),
            });
            count++;
          }
        }

        await onRefresh();
        toast.success(`${count} ofertas importadas com sucesso!`);
      } catch (err: any) {
        toast.error(`Falha ao importar CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const runDispatch = async (offer: OfferItem) => {
    setDispatchingId(offer.id);
    try {
      await onDispatch(offer);
    } finally {
      setDispatchingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm space-y-4">
      {/* 1. Barra de Tags de Marketplaces */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
        <span className="text-[11px] font-bold text-[#6b5e55] uppercase tracking-wider mr-1">Marketplaces:</span>
        {[
          { id: "todos", label: "Todos", emoji: "🌐" },
          { id: "mercadolivre", label: "Mercado Livre", emoji: "🟡" },
          { id: "amazon", label: "Amazon", emoji: "🔵" },
          { id: "shopee", label: "Shopee", emoji: "🟠" },
          { id: "aliexpress", label: "AliExpress", emoji: "🔴" },
          { id: "tiktok", label: "TikTok", emoji: "⚫" },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMarketplaceFilter(m.id)}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 transition-all ${
              marketplaceFilter === m.id
                ? "bg-[#2d241e] text-white shadow-xs font-bold"
                : "border border-[#e8e2d9] bg-[#faf9f6] text-[#6b5e55] hover:bg-white hover:text-[#2d241e]"
            }`}
          >
            <span>{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* 2. Barra de Filtros, Busca e CSV */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 border-y border-[#e8e2d9]/60 py-3">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Busca Global */}
          <div className="relative flex-1 sm:w-60 min-w-[200px]">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar título, categoria, cupom..."
              className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] pl-9 pr-3.5 py-2 text-xs text-[#2d241e] placeholder:text-zinc-400 focus:bg-white focus:border-[#ea580c] focus:outline-none"
            />
          </div>

          {/* Filtro por Nicho */}
          <select
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
            className="rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3 py-2 text-xs font-semibold text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
          >
            <option value="todos">Todos os Nichos</option>
            <option value="impressao_3d">🧵 Impressão 3D & Filamentos</option>
            <option value="ferramentas">🔧 Kits de Ferramentas Maker</option>
            <option value="eletronicos">💡 Eletrônicos & Smart Home</option>
            <option value="geral">📦 Geral</option>
          </select>

          {/* Filtro por Status */}
          <div className="flex rounded-xl border border-[#e8e2d9] bg-[#faf9f6] p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter("todos")}
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                statusFilter === "todos" ? "bg-white text-[#2d241e] shadow-xs" : "text-[#6b5e55]"
              }`}
            >
              Todos ({offers.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pendente")}
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                statusFilter === "pendente" ? "bg-white text-orange-700 shadow-xs" : "text-[#6b5e55]"
              }`}
            >
              Pendentes ({offers.filter((o) => o.status === "pendente").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("enviado")}
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                statusFilter === "enviado" ? "bg-white text-emerald-700 shadow-xs" : "text-[#6b5e55]"
              }`}
            >
              Enviados ({offers.filter((o) => o.status === "enviado").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pausado")}
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                statusFilter === "pausado" ? "bg-white text-zinc-700 shadow-xs" : "text-[#6b5e55]"
              }`}
            >
              Pausados ({offers.filter((o) => o.status === "pausado").length})
            </button>
          </div>
        </div>

        {/* CSV Import/Export */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <label className="flex items-center gap-1.5 rounded-xl border border-[#e8e2d9] bg-white px-3 py-1.5 text-xs font-semibold text-[#2d241e] hover:bg-[#faf9f6] cursor-pointer shadow-xs transition-colors">
            <UploadSimple size={14} />
            <span>Importar CSV</span>
            <input type="file" accept=".csv" onChange={handleImportCsv} className="hidden" />
          </label>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-xl border border-[#e8e2d9] bg-white px-3 py-1.5 text-xs font-semibold text-[#2d241e] hover:bg-[#faf9f6] shadow-xs transition-colors"
          >
            <DownloadSimple size={14} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela de Ofertas */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#e8e2d9] text-[11px] font-bold uppercase tracking-wider text-[#6b5e55]">
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Nicho / Canal</th>
              <th className="py-2.5 px-3">Produto</th>
              <th className="py-2.5 px-3">Preço</th>
              <th className="py-2.5 px-3">Cupom</th>
              <th className="py-2.5 px-3">Link Afiliado</th>
              <th className="py-2.5 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8e2d9]/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-400">
                  Nenhuma oferta encontrada para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filtered.map((offer) => {
                const discount = calculateDiscount(offer.originalPrice, offer.promoPrice);
                return (
                  <tr key={offer.id} className="hover:bg-[#faf9f6]/80 transition-colors">
                    {/* Status */}
                    <td className="py-3 px-3">
                      {offer.status === "enviado" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle size={12} weight="fill" />
                          Enviado {offer.recycledCount ? `(${offer.recycledCount}x)` : ""}
                        </span>
                      ) : offer.status === "pausado" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 border border-zinc-200">
                          <PauseCircle size={12} weight="fill" />
                          Pausado
                        </span>
                      ) : offer.status === "esgotado" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                          <XCircle size={12} weight="fill" />
                          Esgotado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 border border-orange-200">
                          <Clock size={12} weight="fill" />
                          Pendente
                        </span>
                      )}
                    </td>

                    {/* Nicho & Marketplace */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#2d241e]">
                          {offer.niche === "ferramentas"
                            ? "🔧 Ferramentas"
                            : offer.niche === "eletronicos"
                            ? "💡 Eletrônicos"
                            : "🧵 Impressão 3D"}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-[#faf9f6] px-1.5 py-0.5 text-[9px] font-bold text-[#6b5e55] border border-[#e8e2d9] w-fit uppercase">
                          {offer.marketplace || "mercadolivre"}
                        </span>
                      </div>
                    </td>

                    {/* Produto */}
                    <td className="py-3 px-3 max-w-xs">
                      <div className="flex items-center gap-2">
                        {offer.imageUrl && (
                          <img
                            src={offer.imageUrl}
                            alt=""
                            className="h-9 w-9 rounded-lg object-cover border border-[#e8e2d9] shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-[#2d241e] truncate">{offer.title}</p>
                          <p className="text-[10px] text-[#6b5e55]">{offer.category}</p>
                        </div>
                      </div>
                    </td>

                    {/* Preço */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {offer.originalPrice > offer.promoPrice ? (
                        <div>
                          <span className="text-[10px] text-zinc-400 line-through mr-1">
                            R$ {formatCurrency(offer.originalPrice)}
                          </span>
                          <span className="font-bold text-emerald-700">
                            R$ {formatCurrency(offer.promoPrice)}
                          </span>
                          {discount > 0 && (
                            <span className="ml-1 text-[9px] font-black text-orange-600 bg-orange-50 px-1 py-0.5 rounded">
                              {discount}% OFF
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="font-bold text-emerald-700">
                          R$ {formatCurrency(offer.promoPrice)}
                        </span>
                      )}
                    </td>

                    {/* Cupom & Hub */}
                    <td className="py-3 px-3">
                      {offer.coupon ? (
                        <div className="space-y-0.5">
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 font-mono">
                            {offer.coupon}
                          </span>
                          {offer.couponHubUrl && (
                            <a
                              href={offer.couponHubUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-[9px] text-cyan-600 hover:underline"
                            >
                              Central de Cupons ↗
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>

                    {/* Link */}
                    <td className="py-3 px-3 max-w-[120px] truncate">
                      <a
                        href={offer.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-600 hover:underline font-mono text-[11px]"
                      >
                        {offer.affiliateUrl}
                      </a>
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Atualizar Preço ao Vivo */}
                        <button
                          type="button"
                          title="🔄 Atualizar Preço/Dados na Loja"
                          disabled={refreshingPriceId === offer.id}
                          onClick={() => handleRefreshPrice(offer)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-500 hover:text-white transition-colors disabled:opacity-40"
                        >
                          <ArrowsClockwise
                            size={14}
                            className={refreshingPriceId === offer.id ? "animate-spin" : ""}
                          />
                        </button>

                        {/* Disparar Agora */}
                        <button
                          type="button"
                          title="🚀 Disparar Agora"
                          disabled={dispatchingId === offer.id}
                          onClick={() => runDispatch(offer)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-500 hover:text-white transition-colors"
                        >
                          <PaperPlaneTilt size={14} weight="bold" />
                        </button>

                        {/* Editar */}
                        <button
                          type="button"
                          title="✏️ Editar Anúncio"
                          onClick={() => onEdit(offer)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-50 text-zinc-700 border border-zinc-200 hover:bg-zinc-200 transition-colors"
                        >
                          <PencilSimple size={14} />
                        </button>

                        {/* Excluir */}
                        <button
                          type="button"
                          title="🗑️ Excluir"
                          onClick={() => onDelete(offer.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-500 hover:text-white transition-colors"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
