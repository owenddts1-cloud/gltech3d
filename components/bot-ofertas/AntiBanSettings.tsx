"use client";

import { useState } from "react";
import { ShieldCheck, FloppyDisk, Sparkle, ArrowsClockwise } from "@/lib/ui/icons";
import { toast } from "sonner";
import type { BotConfigData } from "./types";

interface Props {
  config: BotConfigData;
  onSaveConfig: (cfg: Partial<BotConfigData>) => Promise<void>;
}

export function AntiBanSettings({ config, onSaveConfig }: Props) {
  const [autoDispatch, setAutoDispatch] = useState(config.autoDispatchEnabled ?? false);
  const [minInterval, setMinInterval] = useState(config.minIntervalMinutes ?? 2);
  const [maxInterval, setMaxInterval] = useState(config.maxIntervalMinutes ?? 15);
  const [recycleMode, setRecycleMode] = useState(config.recycleMode ?? true);
  const [welcomeEnabled, setWelcomeEnabled] = useState(config.welcomeMessageEnabled ?? true);
  const [welcomeGroupName, setWelcomeGroupName] = useState(
    config.welcomeGroupName || "GLTech Ofertas - Impressão 3D",
  );
  const [startHour, setStartHour] = useState(config.dispatchStartHour ?? 9);
  const [endHour, setEndHour] = useState(config.dispatchEndHour ?? 23);
  const [hashtags, setHashtags] = useState(config.defaultHashtags || "#anúncio #cacadoresderenda #GLTech3D");
  const [inviteUrl, setInviteUrl] = useState(config.groupInviteUrl || "");
  const [watermark, setWatermark] = useState(config.watermarkText || "GLTech3D");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (Number(minInterval) > Number(maxInterval)) {
      toast.error("O intervalo mínimo não pode ser maior que o máximo.");
      return;
    }

    setSaving(true);
    try {
      await onSaveConfig({
        autoDispatchEnabled: autoDispatch,
        dispatchIntervalMinutes: Number(minInterval),
        minIntervalMinutes: Number(minInterval),
        maxIntervalMinutes: Number(maxInterval),
        recycleMode,
        welcomeMessageEnabled: welcomeEnabled,
        welcomeGroupName,
        dispatchStartHour: Number(startHour),
        dispatchEndHour: Number(endHour),
        defaultHashtags: hashtags,
        groupInviteUrl: inviteUrl,
        watermarkText: watermark,
      });
      toast.success("Configurações do motor de aquecimento salvas com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-sm space-y-5 max-w-3xl">
      <div className="flex items-center justify-between border-b border-[#e8e2d9]/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-800">
            <ShieldCheck size={18} weight="bold" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#2d241e]">Motor de Aquecimento & Anti-Ban (2 a 15 min)</h3>
            <p className="text-[11px] text-[#6b5e55]">Disparos rápidos, rodízio inteligente e proteção de spam no WhatsApp</p>
          </div>
        </div>
      </div>

      {/* Switch Envio Automático */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-amber-200 bg-amber-50/50">
        <div>
          <h4 className="text-xs font-bold text-[#2d241e]">Agendador Automático em Segundo Plano</h4>
          <p className="text-[11px] text-[#6b5e55]">
            Dispara ofertas com jitter randômico contínuo simulando postagens humanas.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={autoDispatch}
            onChange={(e) => setAutoDispatch(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ea580c]"></div>
        </label>
      </div>

      {/* Range de Disparos Rápidos (2 a 15 minutos) */}
      <div className="p-4 rounded-xl border border-[#e8e2d9] bg-[#faf9f6] space-y-3">
        <div>
          <h4 className="text-xs font-bold text-[#2d241e] flex items-center gap-1.5">
            <span>🔥</span> Range Dinâmico de Disparo (Aquecimento de Grupos)
          </h4>
          <p className="text-[11px] text-[#6b5e55]">
            O agendador calcula um tempo aleatório entre o mínimo e o máximo para cada postagem (ex: 2 min → 5 min → 7 min → 3 min).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#2d241e] mb-1">Intervalo Mínimo (minutos)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={minInterval}
              onChange={(e) => setMinInterval(Number(e.target.value))}
              className="w-full rounded-xl border border-[#e8e2d9] bg-white px-3.5 py-2 text-xs font-bold text-[#2d241e] focus:border-[#ea580c] focus:outline-none"
            />
            <p className="text-[10px] text-[#6b5e55] mt-1">Padrão recomendado: 2 minutos</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#2d241e] mb-1">Intervalo Máximo (minutos)</label>
            <input
              type="number"
              min={2}
              max={120}
              value={maxInterval}
              onChange={(e) => setMaxInterval(Number(e.target.value))}
              className="w-full rounded-xl border border-[#e8e2d9] bg-white px-3.5 py-2 text-xs font-bold text-[#2d241e] focus:border-[#ea580c] focus:outline-none"
            />
            <p className="text-[10px] text-[#6b5e55] mt-1">Padrão recomendado: 15 minutos</p>
          </div>
        </div>
      </div>

      {/* Switch Modo Rodízio / Reciclagem */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
        <div>
          <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
            <span>🔄</span> Modo Rodízio & Reciclagem Inteligente
          </h4>
          <p className="text-[11px] text-emerald-800">
            Se a fila de pendentes zerar, re-dispara automaticamente as ofertas ativas enviadas há mais tempo para nunca deixar o grupo parado.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={recycleMode}
            onChange={(e) => setRecycleMode(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {/* Switch Boas-Vindas Automáticas */}
      <div className="p-4 rounded-xl border border-[#e8e2d9] bg-[#faf9f6] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-[#2d241e] flex items-center gap-1.5">
              <span>🖨️</span> Boas-Vindas Automáticas a Novos Membros
            </h4>
            <p className="text-[11px] text-[#6b5e55]">
              Dispara a mensagem de apresentação com as regras do grupo assim que alguém entrar via link de convite.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={welcomeEnabled}
              onChange={(e) => setWelcomeEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ea580c]"></div>
          </label>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#2d241e] mb-1">Nome do Grupo na Mensagem</label>
          <input
            type="text"
            value={welcomeGroupName}
            onChange={(e) => setWelcomeGroupName(e.target.value)}
            className="w-full rounded-xl border border-[#e8e2d9] bg-white px-3.5 py-2 text-xs text-[#2d241e] focus:border-[#ea580c] focus:outline-none"
          />
        </div>
      </div>

      {/* Janela de Horário Comercial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[#2d241e] mb-1">Horário de Início (h)</label>
          <input
            type="number"
            min={0}
            max={23}
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
          />
          <p className="text-[10px] text-[#6b5e55] mt-1">Ex: 9 (inicia às 09:00)</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#2d241e] mb-1">Horário Limite (h)</label>
          <input
            type="number"
            min={0}
            max={23}
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
          />
          <p className="text-[10px] text-[#6b5e55] mt-1">Ex: 23 (pausa às 23:00 de madrugada)</p>
        </div>
      </div>

      {/* Branding e Hashtags */}
      <div className="space-y-3 pt-2">
        <div>
          <label className="block text-xs font-bold text-[#2d241e] mb-1">Hashtags Oficiais</label>
          <input
            type="text"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#2d241e] mb-1">Link de Convite do Grupo</label>
          <input
            type="url"
            value={inviteUrl}
            onChange={(e) => setInviteUrl(e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
            className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#2d241e] mb-1">Marca D'água da Foto</label>
          <input
            type="text"
            value={watermark}
            onChange={(e) => setWatermark(e.target.value)}
            className="w-full rounded-xl border border-[#e8e2d9] bg-[#faf9f6] px-3.5 py-2 text-xs text-[#2d241e] focus:bg-white focus:border-[#ea580c] focus:outline-none"
          />
        </div>
      </div>

      {/* Salvar */}
      <div className="pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-orange-500/20 hover:opacity-95 transition-opacity disabled:opacity-50"
        >
          <FloppyDisk size={16} />
          <span>{saving ? "Salvando..." : "Salvar Configurações de Aquecimento"}</span>
        </button>
      </div>
    </div>
  );
}
