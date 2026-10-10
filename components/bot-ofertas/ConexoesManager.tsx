"use client";

import { useState } from "react";
import { QrCode, PlugsConnected, CheckCircle, ArrowsClockwise, PaperPlaneTilt, Tag } from "@/lib/ui/icons";
import { toast } from "sonner";
import type { BotStatusData, BotConfigData, NicheGroupMapping } from "./types";

interface Props {
  status: BotStatusData;
  config: BotConfigData;
  onRefreshStatus: () => Promise<void>;
  onSaveConfig: (cfg: Partial<BotConfigData>) => Promise<void>;
}

export function ConexoesManager({ status, config, onRefreshStatus, onSaveConfig }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(config.whatsappTargetGroupId || "");
  const [telegramToken, setTelegramToken] = useState(config.telegramBotToken || "");
  const [telegramChatId, setTelegramChatId] = useState(config.telegramChatId || "");

  // Mapeamentos Multi-Nicho
  const [niche3dJid, setNiche3dJid] = useState(config.nicheGroups?.impressao_3d?.whatsappJid || "");
  const [nicheToolsJid, setNicheToolsJid] = useState(config.nicheGroups?.ferramentas?.whatsappJid || "");
  const [nicheElecJid, setNicheElecJid] = useState(config.nicheGroups?.eletronicos?.whatsappJid || "");

  // Lista unificada de grupos (socket ao vivo + grupos salvos em config) para que nunca fiquem em branco
  const allGroups = [...(status.whatsapp.groups || [])];
  const knownIds = new Set(allGroups.map((g) => g.id));
  if (config.whatsappTargetGroupId && !knownIds.has(config.whatsappTargetGroupId)) {
    allGroups.unshift({
      id: config.whatsappTargetGroupId,
      name: config.whatsappTargetGroupName || "GLTech Ofertas (Principal)",
      participantsCount: 0,
    });
    knownIds.add(config.whatsappTargetGroupId);
  }
  Object.values(config.nicheGroups || {}).forEach((ng) => {
    if (ng?.whatsappJid && !knownIds.has(ng.whatsappJid)) {
      allGroups.push({
        id: ng.whatsappJid,
        name: ng.whatsappName || "GLTech Ofertas",
        participantsCount: 0,
      });
      knownIds.add(ng.whatsappJid);
    }
  });

  const renderGroupOption = (g: { id: string; name: string; participantsCount?: number }) => {
    const isGltech = (g.name || "").toUpperCase().includes("GLTECH");
    return (
      <option
        key={g.id}
        value={g.id}
        className={isGltech ? "bg-emerald-100 text-emerald-950 font-bold" : ""}
        style={isGltech ? { backgroundColor: "#dcfce7", color: "#14532d", fontWeight: "bold" } : undefined}
      >
        {isGltech ? "🟢 " : ""}{g.name} ({g.participantsCount ?? 0} membros)
      </option>
    );
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/bot-ofertas/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const data = await res.json();
      if (!data.success && data.error) {
        toast.error(data.error);
      } else {
        toast.info("Iniciando conexão... Aguarde o QR Code.");
      }
      await onRefreshStatus();
    } catch (err: any) {
      toast.error(err.message || "Erro ao conectar");
    } finally {
      setConnecting(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("Deseja realmente desconectar o WhatsApp?")) return;
    try {
      await fetch("/api/bot-ofertas/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      toast.success("WhatsApp desconectado.");
      await onRefreshStatus();
    } catch (err: any) {
      toast.error(err.message || "Erro ao desconectar");
    }
  };

  const handleSaveNicheBindings = async () => {
    const findGroupName = (jid: string) =>
      status.whatsapp.groups.find((g) => g.id === jid)?.name || "";

    const updatedNicheGroups: Record<string, NicheGroupMapping> = {
      impressao_3d: {
        whatsappJid: niche3dJid,
        whatsappName: findGroupName(niche3dJid) || "GLTech Ofertas - Impressão 3D",
        telegramChatId: config.nicheGroups?.impressao_3d?.telegramChatId || "",
      },
      ferramentas: {
        whatsappJid: nicheToolsJid,
        whatsappName: findGroupName(nicheToolsJid) || "GLTech Ofertas - Ferramentas Maker",
        telegramChatId: config.nicheGroups?.ferramentas?.telegramChatId || "",
      },
      eletronicos: {
        whatsappJid: nicheElecJid,
        whatsappName: findGroupName(nicheElecJid) || "GLTech Ofertas - Eletrônicos & Smart Home",
        telegramChatId: config.nicheGroups?.eletronicos?.telegramChatId || "",
      },
    };

    const mainGroup = status.whatsapp.groups.find((g) => g.id === selectedGroup);

    await onSaveConfig({
      whatsappTargetGroupId: selectedGroup,
      whatsappTargetGroupName: mainGroup ? mainGroup.name : config.whatsappTargetGroupName,
      nicheGroups: updatedNicheGroups,
    });
    toast.success("Mapeamentos de grupos por nicho salvos com sucesso!");
  };

  const handleSaveTelegram = async () => {
    await onSaveConfig({
      telegramBotToken: telegramToken,
      telegramChatId: telegramChatId,
    });
    toast.success("Configurações do Telegram salvas!");
  };

  const isConnected = status.whatsapp.status === "connected";
  const isWaitingQr = status.whatsapp.status === "waiting_qr";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CARD WHATSAPP BAILEYS */}
        <div className="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#e8e2d9]/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <PlugsConnected size={18} weight="bold" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#2d241e]">WhatsApp Gateway (Baileys)</h3>
                <p className="text-[11px] text-[#6b5e55]">Conexão socket direta sem Docker e sem VPS</p>
              </div>
            </div>

            <div>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle size={14} weight="fill" />
                  Conectado
                </span>
              ) : isWaitingQr ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                  <QrCode size={14} />
                  Aguardando QR Code
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600 border border-zinc-200">
                  Desconectado
                </span>
              )}
            </div>
          </div>

          {/* QR Code Container */}
          {isWaitingQr && status.whatsapp.qr ? (
            <div className="flex flex-col items-center justify-center p-4 bg-[#faf9f6] rounded-xl border border-amber-200">
              <p className="text-xs font-semibold text-[#2d241e] mb-2 text-center">
                Abra o WhatsApp no celular &gt; <strong>Aparelhos Conectados</strong> e aponte a câmera:
              </p>
              <div className="bg-white p-2 rounded-xl shadow-md border border-[#e8e2d9]">
                <img src={status.whatsapp.qr} alt="QR Code WhatsApp" className="w-52 h-52 object-contain" />
              </div>
              <button
                type="button"
                onClick={onRefreshStatus}
                className="mt-3 flex items-center gap-1.5 text-xs text-orange-600 font-bold hover:underline"
              >
                <ArrowsClockwise size={14} />
                <span>Verificar status agora</span>
              </button>
            </div>
          ) : isConnected ? (
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
              <p className="text-xs font-bold text-emerald-900">
                Conectado como:{" "}
                <span className="font-mono text-emerald-800">
                  {status.whatsapp.user?.name || status.whatsapp.user?.id || "Aparelho Conectado"}
                </span>
              </p>
              <p className="text-[11px] text-emerald-700">
                Sessão persistente salva em <code className="bg-white px-1 rounded">session_auth/</code>.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-[#faf9f6] rounded-xl border border-[#e8e2d9] text-center space-y-2">
              <p className="text-xs text-[#6b5e55]">
                Nenhum WhatsApp conectado no momento. Clique no botão abaixo para gerar o QR Code de autenticação.
              </p>
            </div>
          )}

          {/* Botões Conectar / Desconectar */}
          <div className="flex gap-2 pt-2">
            {isConnected ? (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 text-rose-700 py-2.5 text-xs font-bold hover:bg-rose-100 transition-colors"
              >
                Desconectar WhatsApp
              </button>
            ) : (
              <button
                type="button"
                disabled={connecting}
                onClick={handleConnect}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-2.5 text-xs font-bold shadow-md shadow-emerald-600/20 hover:opacity-95 transition-opacity"
              >
                <QrCode size={16} />
                <span>{connecting ? "Carregando..." : "Gerar QR Code WhatsApp"}</span>
              </button>
            )}
          </div>
        </div>

        {/* CARD TELEGRAM CANAL */}
        <div className="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#e8e2d9]/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800">
                <PaperPlaneTilt size={18} weight="bold" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#2d241e]">Canal do Telegram (Opcional)</h3>
                <p className="text-[11px] text-[#6b5e55]">Disparo simultâneo em canais e grupos do Telegram</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
              Bot API
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Bot Token (BotFather)</label>
              <input
                type="text"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="Ex: 7123456789:AAH..."
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs font-mono text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2d241e] mb-1">Chat ID do Canal / Grupo</label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Ex: -1001234567890 ou @meucanaldeofertas"
                className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs font-mono text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveTelegram}
                className="w-full rounded-xl bg-[#2d241e] text-white py-2.5 text-xs font-bold hover:bg-black transition-colors"
              >
                Salvar Configurações do Telegram
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CARD SISTEMA MULTI-NICHO & VINCULAÇÃO DE GRUPOS */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#e8e2d9]/60 pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#2d241e] flex items-center gap-1.5">
              <span>🎯</span> Vinculação de Grupos por Nicho (Multi-Grupo)
            </h3>
            <p className="text-xs text-[#6b5e55]">
              Ao postar uma oferta de Filamentos, ela vai para o grupo 3D; ferramentas para o grupo de oficina, etc.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Nicho 1: Impressão 3D */}
          <div className="p-4 rounded-xl border border-[#e8e2d9] bg-[#faf9f6] space-y-2">
            <h4 className="text-xs font-bold text-[#2d241e]">🧵 Nicho 1: Impressão 3D & Filamentos</h4>
            <p className="text-[10px] text-[#6b5e55]">Filamentos, resinas, bicos, mesas PEI e impressoras</p>
            <select
              value={niche3dJid}
              onChange={(e) => setNiche3dJid(e.target.value)}
              className="w-full rounded-xl border border-[#e8e2d9] bg-white px-3 py-2 text-xs text-[#2d241e] focus:border-[#ea580c] focus:outline-none"
            >
              <option value="">Selecione o grupo de Impressão 3D...</option>
              {allGroups.map(renderGroupOption)}
            </select>
          </div>

          {/* Nicho 2: Ferramentas */}
          <div className="p-4 rounded-xl border border-[#e8e2d9] bg-[#faf9f6] space-y-2">
            <h4 className="text-xs font-bold text-[#2d241e]">🔧 Nicho 2: Kits de Ferramentas Maker</h4>
            <p className="text-[10px] text-[#6b5e55]">Alicates, chaves allen, paquímetros e sopradores</p>
            <select
              value={nicheToolsJid}
              onChange={(e) => setNicheToolsJid(e.target.value)}
              className="w-full rounded-xl border border-[#e8e2d9] bg-white px-3 py-2 text-xs text-[#2d241e] focus:border-[#ea580c] focus:outline-none"
            >
              <option value="">Selecione o grupo de Ferramentas...</option>
              {allGroups.map(renderGroupOption)}
            </select>
          </div>

          {/* Nicho 3: Eletrônicos */}
          <div className="p-4 rounded-xl border border-[#e8e2d9] bg-[#faf9f6] space-y-2">
            <h4 className="text-xs font-bold text-[#2d241e]">💡 Nicho 3: Eletrônicos & Smart Home</h4>
            <p className="text-[10px] text-[#6b5e55]">Sensores, placas, tomadas inteligentes e automação</p>
            <select
              value={nicheElecJid}
              onChange={(e) => setNicheElecJid(e.target.value)}
              className="w-full rounded-xl border border-[#e8e2d9] bg-white px-3 py-2 text-xs text-[#2d241e] focus:border-[#ea580c] focus:outline-none"
            >
              <option value="">Selecione o grupo de Eletrônicos...</option>
              {allGroups.map(renderGroupOption)}
            </select>
          </div>
        </div>

        {/* Grupo Padrão Fallback */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#e8e2d9]/60">
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-bold text-[#2d241e] mb-1">
              Grupo Padrão Fallback (para ofertas sem nicho específico):
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3 py-2 text-xs text-[#2d241e] focus:border-[#ea580c] focus:outline-none"
            >
              <option value="">Selecione um grupo padrão...</option>
              {allGroups.map(renderGroupOption)}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSaveNicheBindings}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-orange-500/20 hover:opacity-95 transition-opacity"
          >
            <span>Salvar Todos os Mapeamentos de Nicho</span>
          </button>
        </div>
      </div>
    </div>
  );
}
