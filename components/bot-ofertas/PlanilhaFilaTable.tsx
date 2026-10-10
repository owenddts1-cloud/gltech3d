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
} from "@/lib/ui/icons";
import { formatCurrency } from "@/lib/bot-engine/formatter";
import { toast } from "sonner";
import type { OfferItem } from "./types";

interface Props {
  offers: OfferItem[];
  onDispatch: (offer: OfferItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (offer: OfferItem) => void;
  onRefresh: () => Promise<void>;
}

export function PlanilhaFilaTable({ offers, onDispatch, onDelete, onEdit, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendente" | "enviado">("todos");
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const filtered = offers.filter((o) => {
    const matchesSearch =
      o.title.toLowerCase().includes(search.toLowerCase()) ||
      o.category.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "todos" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCsv = () => {
    const headers = ["ID", "Título", "Categoria", "Preço De", "Preço Por", "Cupom", "Link Afiliado", "URL Imagem", "Status"];
    const rows = offers.map((o) => [
      o.id,
      `"${o.title.replace(/"/g, '""')}"`,
      `"${o.category}"`,
      o.originalPrice,
      o.promoPrice,
      `"${o.coupon}"`,
      `"${o.affiliateUrl}"`,
      `"${o.imageUrl}"`,
      o.status,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ofertas_gltech_${new Date().toISOString().slice(0, 10)}.csv`);
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
        const lines = text.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          toast.error("O arquivo CSV está vazio ou contém apenas o cabeçalho.");
          return;
        }

        // Processa cada linha
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
          if (cols.length >= 5) {
            await fetch("/api/bot-ofertas/offers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: cols[1] || cols[0] || "Oferta Importada",
                category: cols[2] || "Filamentos 3D",
                originalPrice: parseFloat(cols[3] || "0") || 0,
                promoPrice: parseFloat(cols[4] || "0") || 0,
                coupon: cols[5] || "",
                affiliateUrl: cols[6] || "",
                imageUrl: cols[7] || "",
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
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#e8e2d9]/60 pb-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou categoria..."
              className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] pl-9 pr-3.5 py-2 text-xs text-[#2d241e] placeholder:text-zinc-400 focus:bg-white focus:border-[#ea580c] focus:outline-none focus:ring-1 focus:ring-[#ea580c]"
            />
          </div>

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
          </div>
        </div>

        {/* CSV Import/Export */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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

      {/* Tabela de Ofertas */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#e8e2d9] text-[11px] font-bold uppercase tracking-wider text-[#6b5e55]">
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Produto</th>
              <th className="py-2.5 px-3">Preço</th>
              <th className="py-2.5 px-3">Cupom</th>
              <th className="py-2.5 px-3">Link</th>
              <th className="py-2.5 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8e2d9]/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-400">
                  Nenhuma oferta encontrada na fila.
                </td>
              </tr>
            ) : (
              filtered.map((offer) => (
                <tr key={offer.id} className="hover:bg-[#faf9f6]/80 transition-colors">
                  <td className="py-3 px-3">
                    {offer.status === "enviado" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <CheckCircle size={12} weight="fill" />
                        Enviado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold text-orange-700 border border-orange-200">
                        <Clock size={12} weight="fill" />
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 max-w-xs">
                    <p className="font-bold text-[#2d241e] truncate">{offer.title}</p>
                    <p className="text-[10px] text-[#6b5e55]">{offer.category}</p>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {offer.originalPrice > offer.promoPrice ? (
                      <div>
                        <span className="text-[10px] text-zinc-400 line-through mr-1">
                          R$ {formatCurrency(offer.originalPrice)}
                        </span>
                        <span className="font-bold text-emerald-700">
                          R$ {formatCurrency(offer.promoPrice)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-bold text-emerald-700">
                        R$ {formatCurrency(offer.promoPrice)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {offer.coupon ? (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 font-mono">
                        {offer.coupon}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
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
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        title="Disparar Agora"
                        disabled={dispatchingId === offer.id}
                        onClick={() => runDispatch(offer)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-500 hover:text-white transition-colors"
                      >
                        <PaperPlaneTilt size={14} weight="bold" />
                      </button>
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => onEdit(offer)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-50 text-zinc-700 border border-zinc-200 hover:bg-zinc-200 transition-colors"
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => onDelete(offer.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-500 hover:text-white transition-colors"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
