"use client";

import { CheckCircle, Warning, Clock } from "@/lib/ui/icons";
import type { HistoryItem } from "./types";

interface Props {
  history: HistoryItem[];
}

export function HistoricoView({ history }: Props) {
  return (
    <div className="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm space-y-4 max-w-4xl">
      <div className="border-b border-[#e8e2d9]/60 pb-3">
        <h3 className="text-sm font-bold text-[#2d241e]">Histórico de Disparos</h3>
        <p className="text-xs text-[#6b5e55]">Registro de postagens realizadas pelo bot nos grupos e canais.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#e8e2d9] text-[11px] font-bold uppercase tracking-wider text-[#6b5e55]">
              <th className="py-2.5 px-3">Data / Hora</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Canal</th>
              <th className="py-2.5 px-3">Título da Oferta</th>
              <th className="py-2.5 px-3">Destino</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8e2d9]/60">
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-400">
                  Nenhum disparo registrado ainda.
                </td>
              </tr>
            ) : (
              history.map((item) => (
                <tr key={item.id} className="hover:bg-[#faf9f6]/80 transition-colors">
                  <td className="py-3 px-3 text-[#6b5e55] whitespace-nowrap">
                    {item.timestamp ? new Date(item.timestamp).toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="py-3 px-3">
                    {item.status === "success" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <CheckCircle size={12} weight="fill" />
                        Sucesso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                        <Warning size={12} weight="fill" />
                        Erro
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-semibold uppercase text-[10px] text-zinc-600">
                    {item.channel}
                  </td>
                  <td className="py-3 px-3 font-medium text-[#2d241e] max-w-xs truncate">
                    {item.title}
                  </td>
                  <td className="py-3 px-3 text-[11px] text-[#6b5e55] max-w-[140px] truncate">
                    {item.target}
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
