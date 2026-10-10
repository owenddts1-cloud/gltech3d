"use client";

import { useState, useEffect } from "react";
import { Tag, Sparkle, PlugsConnected, ShieldCheck, Clock, ArrowsClockwise, Lightning } from "@/lib/ui/icons";
import { NovaOfertaForm, type NovaOfertaFormData } from "@/components/bot-ofertas/NovaOfertaForm";
import { WhatsAppMockupPreview } from "@/components/bot-ofertas/WhatsAppMockupPreview";
import { PlanilhaFilaTable } from "@/components/bot-ofertas/PlanilhaFilaTable";
import { EditarOfertaModal } from "@/components/bot-ofertas/EditarOfertaModal";
import { ConexoesManager } from "@/components/bot-ofertas/ConexoesManager";
import { AntiBanSettings } from "@/components/bot-ofertas/AntiBanSettings";
import { HistoricoView } from "@/components/bot-ofertas/HistoricoView";
import { toast } from "sonner";
import type { OfferItem, BotConfigData, BotStatusData, HistoryItem } from "@/components/bot-ofertas/types";

interface Props {
  initialStatus: BotStatusData;
  initialOffers: OfferItem[];
  initialConfig: BotConfigData;
  initialHistory: HistoryItem[];
}

export function BotOfertasClient({
  initialStatus,
  initialOffers,
  initialConfig,
  initialHistory,
}: Props) {
  const [activeTab, setActiveTab] = useState<"ofertas" | "fila" | "conexoes" | "automacao" | "historico">("ofertas");
  const [status, setStatus] = useState<BotStatusData>(initialStatus);
  const [offers, setOffers] = useState<OfferItem[]>(initialOffers);
  const [config, setConfig] = useState<BotConfigData>(initialConfig);
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [isAutoDispatching, setIsAutoDispatching] = useState(false);
  const [lastPriceSync, setLastPriceSync] = useState<string | null>(null);
  const [editingOffer, setEditingOffer] = useState<OfferItem | null>(null);

  // Form state compartilhado entre o Form e o WhatsApp Mockup Preview
  const [formData, setFormData] = useState<NovaOfertaFormData>({
    title: "Filamento PLA Basic 1.75mm GLTech3D 1kg Vermelho",
    category: "Filamentos 3D",
    niche: "impressao_3d",
    marketplace: "mercadolivre",
    copyStyle: "padrao",
    originalPrice: "119.90",
    promoPrice: "89.00",
    coupon: "10OFFMAKER",
    couponHubUrl: "https://www.mercadolivre.com.br/cupons",
    couponTutorial: "",
    affiliateUrl: "https://gltech3d.vercel.app/filamentos",
    imageUrl: "https://http2.mlstatic.com/D_NQ_NP_900224-MLB78901234567_092024-O.webp",
  });

  // Atualização de dados
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const [statusRes, offersRes, configRes, histRes] = await Promise.all([
        fetch("/api/bot-ofertas/status").then((r) => r.json()),
        fetch("/api/bot-ofertas/offers").then((r) => r.json()),
        fetch("/api/bot-ofertas/config").then((r) => r.json()),
        fetch("/api/bot-ofertas/history").then((r) => r.json()),
      ]);

      if (statusRes) setStatus(statusRes);
      if (offersRes?.offers) setOffers(offersRes.offers);
      if (configRes) setConfig(configRes);
      if (histRes?.history) setHistory(histRes.history);
    } catch (err: any) {
      console.warn("Falha ao atualizar dados do bot:", err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sincronização contínua de preços de 5 em 5 minutos
  const syncPrices = async (manual = false) => {
    setIsSyncingPrices(true);
    try {
      const res = await fetch("/api/bot-ofertas/sync-prices", { method: "POST" });
      const data = await res.json();
      const nowStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setLastPriceSync(nowStr);

      if (data.success) {
        if (data.updatedCount > 0) {
          toast.success(
            `Preços atualizados! ${data.updatedCount} ${data.updatedCount === 1 ? "oferta teve seu valor sincronizado" : "ofertas tiveram seus valores sincronizados"} com as lojas.`,
          );
          await refreshData();
        } else if (manual) {
          toast.info("Todos os preços conferidos e estão 100% atualizados com os anúncios!");
        }
      }
    } catch (err: any) {
      if (manual) toast.error("Falha ao checar preços nas lojas: " + err.message);
    } finally {
      setIsSyncingPrices(false);
    }
  };

  // Disparo autônomo da fila
  const runAutoDispatch = async (manual = false) => {
    setIsAutoDispatching(true);
    try {
      const res = await fetch("/api/bot-ofertas/auto-dispatch", { method: "POST" });
      const data = await res.json();
      if (data.dispatched && data.offer) {
        toast.success(`Disparo automático: "${data.offer.title}" enviado aos grupos!`);
        await refreshData();
      } else if (manual) {
        toast.info(data.message || "Fila de ofertas sem itens pendentes.");
      }
    } catch (err: any) {
      if (manual) toast.error("Falha ao processar disparo da fila: " + err.message);
    } finally {
      setIsAutoDispatching(false);
    }
  };

  // Timers contínuos de segundo plano (Preços a cada 5 min e Disparo a cada 3 min)
  useEffect(() => {
    // Sincronização inicial de preços
    const initialTimer = setTimeout(() => {
      syncPrices(false);
    }, 3000);

    const priceInterval = setInterval(() => {
      syncPrices(false);
    }, 5 * 60 * 1000);

    const dispatchInterval = setInterval(() => {
      if (config.autoDispatchEnabled) {
        runAutoDispatch(false);
      }
    }, 3 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(priceInterval);
      clearInterval(dispatchInterval);
    };
  }, [config.autoDispatchEnabled]);

  // Polling suave de status se estiver aguardando QR Code
  useEffect(() => {
    if (status.whatsapp.status === "waiting_qr") {
      const timer = setInterval(() => {
        fetch("/api/bot-ofertas/status")
          .then((r) => r.json())
          .then((s) => s && setStatus(s))
          .catch(() => {});
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [status.whatsapp.status]);

  // Ações
  const handleOfferCreated = async (newOffer: OfferItem, dispatchNow = false) => {
    setOffers((prev) => [newOffer, ...prev]);
    if (dispatchNow) {
      await handleDispatchOffer(newOffer);
    }
  };

  const handleDispatchOffer = async (offer: OfferItem) => {
    setIsDispatching(true);
    try {
      const res = await fetch("/api/bot-ofertas/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offer.id,
          targetGroupJid: config.whatsappTargetGroupId,
          sendWhatsapp: true,
          sendTelegram: Boolean(config.telegramChatId),
        }),
      });
      const data = await res.json();
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      toast.success("Oferta disparada com sucesso no grupo!");
      await refreshData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao disparar oferta");
    } finally {
      setIsDispatching(false);
    }
  };

  const handleDeleteOffer = async (id: string) => {
    if (!confirm("Deseja realmente remover esta oferta?")) return;
    try {
      await fetch(`/api/bot-ofertas/offers/${id}`, { method: "DELETE" });
      setOffers((prev) => prev.filter((o) => o.id !== id));
      toast.success("Oferta removida com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover oferta");
    }
  };

  const handleEditOffer = (offer: OfferItem) => {
    setEditingOffer(offer);
  };

  const handleSaveEditedOffer = async (updated: OfferItem) => {
    const res = await fetch(`/api/bot-ofertas/offers/${updated.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    const data = await res.json();
    if (!data.success && data.error) {
      throw new Error(data.error);
    }
    setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    await refreshData();
  };

  const handleSaveConfig = async (newCfg: Partial<BotConfigData>) => {
    const res = await fetch("/api/bot-ofertas/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCfg),
    });
    const data = await res.json();
    if (data.config) {
      setConfig(data.config);
    }
  };

  const pendingCount = offers.filter((o) => o.status === "pendente").length;

  return (
    <div className="space-y-6">
      {/* Top Header Card com Indicadores */}
      <div className="rounded-2xl border border-[#e8e2d9] bg-white p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6b5e55] mb-1">
            <span>Automações</span>
            <span>/</span>
            <span className="text-[#ea580c] font-bold">Bots de Ofertas</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#2d241e] font-sora">
            Bot de Ofertas & Afiliados 3D
          </h1>
          <p className="text-xs text-[#6b5e55]">
            Disparos automáticos de promoções para grupos de WhatsApp (Baileys) e Telegram com anti-ban inteligente.
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Status WhatsApp */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e8e2d9] bg-[#faf9f6] px-3 py-1.5 text-xs font-bold text-[#2d241e]">
            <span
              className={`h-2 w-2 rounded-full ${
                status.whatsapp.status === "connected"
                  ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                  : status.whatsapp.status === "waiting_qr"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-emerald-500 shadow-xs"
              }`}
            />
            <span>
              WhatsApp:{" "}
              {status.whatsapp.status === "connected"
                ? "Conectado"
                : status.whatsapp.status === "waiting_qr"
                ? "Aguardando QR"
                : "Conectado (Cloud)"}
            </span>
          </div>

          {/* Status Automação */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e8e2d9] bg-[#faf9f6] px-3 py-1.5 text-xs font-bold text-[#2d241e]">
            <span
              className={`h-2 w-2 rounded-full ${
                config.autoDispatchEnabled ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>Automação: {config.autoDispatchEnabled ? "Ativa" : "Pausada"}</span>
          </div>

          {/* Status Auto-Sync de Preços */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-bold text-emerald-900">
            <span
              className={`h-2 w-2 rounded-full bg-emerald-500 ${
                isSyncingPrices ? "animate-ping" : "animate-pulse"
              }`}
            />
            <span>Preços: Auto-Sync (5 min)</span>
            {lastPriceSync && (
              <span className="text-[10px] text-emerald-700 font-semibold">({lastPriceSync})</span>
            )}
          </div>

          {/* Botão Sincronizar Preços Agora */}
          <button
            type="button"
            onClick={() => syncPrices(true)}
            disabled={isSyncingPrices}
            className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-950 hover:bg-orange-100 transition-colors shadow-2xs"
            title="Conferir e atualizar valores de todas as ofertas nas lojas agora"
          >
            <ArrowsClockwise size={13} className={isSyncingPrices ? "animate-spin text-[#ea580c]" : ""} />
            <span>{isSyncingPrices ? "Checando lojas..." : "Sincronizar Preços"}</span>
          </button>

          {/* Botão Disparar Próxima Oferta Agora */}
          <button
            type="button"
            onClick={() => runAutoDispatch(true)}
            disabled={isAutoDispatching}
            className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-100 transition-colors shadow-2xs"
            title="Disparar a próxima oferta da fila agora para os grupos configurados"
          >
            <Lightning size={13} className={isAutoDispatching ? "animate-bounce text-emerald-600" : "text-emerald-700"} />
            <span>{isAutoDispatching ? "Disparando..." : "Disparar da Fila"}</span>
          </button>

          {/* Botão Atualizar Geral */}
          <button
            type="button"
            onClick={refreshData}
            disabled={isRefreshing}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e8e2d9] bg-white text-[#2d241e] hover:bg-[#faf9f6] transition-colors"
            title="Atualizar dados"
          >
            <ArrowsClockwise size={14} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Banner de Operação 100% Interligada no CRM (Sem Terminal) */}
      <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 p-3.5 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 text-sm font-bold">
            ⚡
          </span>
          <div>
            <p className="font-bold text-[#2d241e]">Sistema 100% Interligado e Operacional no Site</p>
            <p className="text-[#6b5e55] text-[11px] mt-0.5">
              Extração de produtos com cupons, sincronização contínua de valores das lojas a cada 5 minutos e disparos diretamente pelo navegador.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100/90 text-emerald-900 px-2 py-0.5 text-[10px] font-bold">
            🟢 Nuvem Ativa
          </span>
        </div>
      </div>

      {/* Tabs Navigation com Paleta Clay */}
      <div className="flex border-b border-[#e8e2d9] space-x-1 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("ofertas")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "ofertas"
              ? "border-[#ea580c] text-[#ea580c] bg-white shadow-xs font-extrabold"
              : "border-transparent text-[#6b5e55] hover:text-[#2d241e] hover:bg-white/50"
          }`}
        >
          <span>🛍️</span>
          <span>Nova Oferta</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fila")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "fila"
              ? "border-[#ea580c] text-[#ea580c] bg-white shadow-xs font-extrabold"
              : "border-transparent text-[#6b5e55] hover:text-[#2d241e] hover:bg-white/50"
          }`}
        >
          <span>📋</span>
          <span>Planilha de Ofertas</span>
          {pendingCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ea580c] px-1 text-[9px] font-black text-white">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("conexoes")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "conexoes"
              ? "border-[#ea580c] text-[#ea580c] bg-white shadow-xs font-extrabold"
              : "border-transparent text-[#6b5e55] hover:text-[#2d241e] hover:bg-white/50"
          }`}
        >
          <span>📱</span>
          <span>WhatsApp & Canais</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("automacao")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "automacao"
              ? "border-[#ea580c] text-[#ea580c] bg-white shadow-xs font-extrabold"
              : "border-transparent text-[#6b5e55] hover:text-[#2d241e] hover:bg-white/50"
          }`}
        >
          <span>⚙️</span>
          <span>Anti-Ban & Horários</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("historico")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "historico"
              ? "border-[#ea580c] text-[#ea580c] bg-white shadow-xs font-extrabold"
              : "border-transparent text-[#6b5e55] hover:text-[#2d241e] hover:bg-white/50"
          }`}
        >
          <span>📜</span>
          <span>Histórico</span>
        </button>
      </div>

      {/* Conteúdo das Abas */}
      {activeTab === "ofertas" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 items-start">
          <NovaOfertaForm
            formData={formData}
            setFormData={setFormData}
            onOfferCreated={handleOfferCreated}
            isSubmitting={isDispatching}
          />

          <div className="sticky top-4">
            <WhatsAppMockupPreview
              offer={formData}
              groupName={config.whatsappTargetGroupName || "Tech Ofertas - Impressão 3D"}
              groupInviteUrl={config.groupInviteUrl}
              defaultHashtags={config.defaultHashtags}
              watermarkText={config.watermarkText}
              onDispatch={() =>
                handleDispatchOffer({
                  id: "preview",
                  ...formData,
                  originalPrice: parseFloat(formData.originalPrice) || 0,
                  promoPrice: parseFloat(formData.promoPrice) || 0,
                  status: "pendente",
                  createdAt: new Date().toISOString(),
                  dispatchedAt: null,
                })
              }
              isDispatching={isDispatching}
            />
          </div>
        </div>
      )}

      {activeTab === "fila" && (
        <PlanilhaFilaTable
          offers={offers}
          onDispatch={handleDispatchOffer}
          onDelete={handleDeleteOffer}
          onEdit={handleEditOffer}
          onRefresh={refreshData}
        />
      )}

      {activeTab === "conexoes" && (
        <ConexoesManager
          status={status}
          config={config}
          onRefreshStatus={refreshData}
          onSaveConfig={handleSaveConfig}
        />
      )}

      {activeTab === "automacao" && (
        <AntiBanSettings config={config} onSaveConfig={handleSaveConfig} />
      )}

      {activeTab === "historico" && <HistoricoView history={history} />}
      <EditarOfertaModal
        offer={editingOffer}
        isOpen={Boolean(editingOffer)}
        onClose={() => setEditingOffer(null)}
        onSave={handleSaveEditedOffer}
      />
    </div>
  );
}
