"use client";

import { useState } from "react";
import { QrCode, PlugsConnected, CheckCircle, Warning, ArrowsClockwise, PaperPlaneTilt } from "@/lib/ui/icons";
import { toast } from "sonner";
import type { BotStatusData, BotConfigData } from "./types";

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
  const [testingTg, setTestingTg] = useState(false);

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

  const handleSaveGroup = async () => {
    const group = status.whatsapp.groups.find((g) => g.id === selectedGroup);
    await onSaveConfig({
      whatsappTargetGroupId: selectedGroup,
      whatsappTargetGroupName: group ? group.name : config.whatsappTargetGroupName,
    });
    toast.success("Grupo alvo do WhatsApp atualizado!");
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

        {/* Seleção do Grupo Alvo */}
        <div className="space-y-1.5 pt-2">
          <label className="block text-xs font-bold text-[#2d241e]">Grupo de Destino das Ofertas</label>
          <div className="flex gap-2">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="flex-1 rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
            >
              <option value="">Selecione um grupo participante...</option>
              {status.whatsapp.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.participantsCount} membros)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveGroup}
              disabled={!selectedGroup}
              className="rounded-xl bg-[#2d241e] text-white px-3.5 py-2 text-xs font-bold hover:bg-black transition-colors disabled:opacity-40"
            >
              Salvar
            </button>
          </div>
          <p className="text-[10px] text-[#6b5e55]">
            Grupo atual: <strong>{config.whatsappTargetGroupName || "Nenhum configurado"}</strong>
          </p>
        </div>

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
  );
}
