"use client";

import { useState } from "react";
import { X, PlugsConnected, PaperPlaneTilt, CheckCircle, Robot, VideoCamera, Cube } from "@/lib/ui/icons";
import { dataMesh } from "@/lib/mesh/data-mesh";
import type { AppDomain, MeshPayloadType } from "@/types/hub";

interface CrossAppMeshModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentApp?: AppDomain;
}

export function CrossAppMeshModal({ isOpen, onClose, currentApp = "crm" }: CrossAppMeshModalProps) {
  const [targetApp, setTargetApp] = useState<AppDomain>(
    currentApp === "automations" ? "crm" : "automations"
  );
  const [payloadType, setPayloadType] = useState<MeshPayloadType>("CRM_TO_AUTOMATION");
  const [payloadJson, setPayloadJson] = useState<string>(
    JSON.stringify({ orderId: "OS-2026-99", client: "GLTech Corp", items: 5 }, null, 2)
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleIntegrate = () => {
    try {
      const parsedData = JSON.parse(payloadJson);
      dataMesh.emit(currentApp, targetApp, payloadType, parsedData);
      setStatusMsg("Dados integrados e transmitidos via Data Mesh com sucesso!");
      setTimeout(() => {
        setStatusMsg(null);
        onClose();
      }, 1800);
    } catch {
      setStatusMsg("Erro: JSON inválido para sincronização.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-xl bg-card border border-border p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent border border-accent/20">
              <PlugsConnected size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Integrar Dados Inter-Apps</h2>
              <p className="text-xs text-muted-foreground">Barramento de sincronização ativa (Cross-App Mesh)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Seleção de Destino */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-medium text-foreground mb-1">Origem:</label>
            <div className="rounded-md bg-muted/50 p-2.5 border border-border capitalize font-semibold text-accent">
              {currentApp}
            </div>
          </div>
          <div>
            <label className="block font-medium text-foreground mb-1">Destino:</label>
            <select
              value={targetApp}
              onChange={(e) => setTargetApp(e.target.value as AppDomain)}
              className="w-full rounded-md bg-background border border-border p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="crm">CRM (Pedidos & Clientes)</option>
              <option value="automations">AUTOMAÇÕES (n8n)</option>
              <option value="content-studio">CRIAÇÃO DE CONTEÚDO (AI Studio)</option>
            </select>
          </div>
        </div>

        {/* Tipo de Ação */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Tipo de Payload Cross-App:</label>
          <select
            value={payloadType}
            onChange={(e) => setPayloadType(e.target.value as MeshPayloadType)}
            className="w-full rounded-md bg-background border border-border p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="CRM_TO_AUTOMATION">CRM ➔ Automações: Enviar Clientes/O.S. para n8n</option>
            <option value="CONTENT_TO_CRM">Conteúdo ➔ CRM: Anexar Vídeo/Asset a Produto 3D</option>
            <option value="CONTENT_TO_AUTOMATION">Conteúdo ➔ Automações: Publicar Mídia nas Redes Sociais</option>
            <option value="AUTOMATION_TO_CRM">Automações ➔ CRM: Atualizar Status de Produção</option>
          </select>
        </div>

        {/* Payload JSON */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Payload JSON Transmitido:</label>
          <textarea
            rows={4}
            value={payloadJson}
            onChange={(e) => setPayloadJson(e.target.value)}
            className="w-full rounded-md bg-zinc-950 font-mono text-xs text-emerald-400 p-3 border border-border focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {statusMsg && (
          <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
            <CheckCircle size={16} />
            <span>{statusMsg}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={handleIntegrate}
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
          >
            <PaperPlaneTilt size={14} />
            <span>Disparar Sincronização</span>
          </button>
        </div>
      </div>
    </div>
  );
}
