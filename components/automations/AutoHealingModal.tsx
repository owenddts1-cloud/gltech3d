"use client";

import { X, Robot, Sparkle, ArrowRight, ShieldCheck } from "@/lib/ui/icons";
import type { N8nExecutionLog } from "@/types/hub";

interface AutoHealingModalProps {
  log: N8nExecutionLog | null;
  onClose: () => void;
}

export function AutoHealingModal({ log, onClose }: AutoHealingModalProps) {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-5 text-white">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Robot size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Agente Auto-Healing IA</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                  <Sparkle size={10} />
                  Diagnóstico Ativo
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Análise automática de causa-raiz para a falha do workflow</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Workflow Info */}
        <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-950 p-3 rounded-xl border border-zinc-800">
          <div>
            <span className="text-zinc-500">Workflow:</span>
            <div className="font-semibold text-zinc-200">{log.workflowName}</div>
          </div>
          <div>
            <span className="text-zinc-500">Execution ID:</span>
            <div className="font-mono text-zinc-400">{log.id}</div>
          </div>
        </div>

        {/* Stack Trace */}
        <div>
          <label className="block text-xs font-semibold text-red-400 mb-1">Stack Trace de Erro Capturada:</label>
          <pre className="w-full rounded-xl bg-red-950/30 border border-red-500/20 p-3 font-mono text-xs text-red-300 overflow-x-auto">
            {log.errorStackTrace || "Erro genérico no nó de disparo HTTP."}
          </pre>
        </div>

        {/* AI Diagnostic Suggestion */}
        <div className="rounded-xl bg-gradient-to-br from-purple-950/40 via-zinc-900 to-purple-950/20 border border-purple-500/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-purple-300 text-xs font-bold">
            <Sparkle size={16} className="text-purple-400" />
            <span>Solução Recomendada pela IA:</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {log.aiDiagnosticSuggestion ||
              "Identificamos um erro de timeout ou credencial expirada. Recomendamos re-testar a conexão de API no Secrets Vault e reiniciar a execução."}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Fechar
          </button>
          <button
            onClick={() => {
              alert("Tentando re-execução corrigida em background via Agente IA...");
              onClose();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 transition-colors shadow-lg shadow-purple-600/20"
          >
            <span>Auto-Corrigir & Re-executar</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
