"use client";

import { useState } from "react";
import { saveChannelCredentials, simulateTestSale, type SalesChannelIntegration } from "@/app/actions/sales/channels";
import SalesClient from "./SalesClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug, Zap, CheckCircle2, Copy, RefreshCw, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ContactOption } from "@/app/actions/contacts/actions";
import type { SaleChannelOption as ChannelOption } from "@/app/actions/sale-channels/actions";
import type { SaleProductOption as ProductOption, SaleRow as Sale } from "@/lib/sales/config";

interface SalesChannelViewProps {
  platform: 'Shopee' | 'Mercado Livre' | 'Facebook';
  title: string;
  subtitle: string;
  initialSales: Sale[];
  productOptions: ProductOption[];
  contactOptions: ContactOption[];
  channelOptions: ChannelOption[];
  integration: SalesChannelIntegration;
}

export function SalesChannelView({
  platform,
  title,
  subtitle,
  initialSales,
  productOptions,
  contactOptions,
  channelOptions,
  integration: initialIntegration,
}: SalesChannelViewProps) {
  const [integration, setIntegration] = useState<SalesChannelIntegration>(initialIntegration);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form field states
  const [keyField1, setKeyField1] = useState(integration.credentials.field1 || integration.credentials.partner_id || integration.credentials.app_id || "");
  const [keyField2, setKeyField2] = useState(integration.credentials.field2 || integration.credentials.partner_key || integration.credentials.secret_key || "");
  const [isEnabled, setIsEnabled] = useState(integration.is_enabled);

  const fieldLabels: Record<string, { label1: string; label2: string }> = {
    Shopee: { label1: "Shopee Partner ID", label2: "Shopee Partner Key / Secret" },
    "Mercado Livre": { label1: "Mercado Livre App ID", label2: "Mercado Livre Secret Key" },
    Facebook: { label1: "Facebook Access Token", label2: "Pixel / Page ID" },
  };

  const currentLabels = fieldLabels[platform] ?? { label1: "API Key / Client ID", label2: "Secret Key / Token" };

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/v1/webhooks/sales-channel?platform=${encodeURIComponent(platform)}&secret=${integration.webhook_secret}`
    : `/api/v1/webhooks/sales-channel?platform=${encodeURIComponent(platform)}&secret=${integration.webhook_secret}`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do Webhook copiada para a área de transferência!");
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const credentials = {
        field1: keyField1,
        field2: keyField2,
        partner_id: keyField1,
        partner_key: keyField2,
        app_id: keyField1,
        secret_key: keyField2,
      };

      const res = await saveChannelCredentials(platform, isEnabled, credentials);
      if (res.ok) {
        setIntegration(prev => ({
          ...prev,
          is_enabled: isEnabled,
          credentials,
        }));
        toast.success(`Configurações de ${platform} salvas com sucesso!`);
        setIsConfigOpen(false);
      } else {
        toast.error("Erro ao salvar credenciais: " + res.error);
      }
    } catch (err) {
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSimulateSale = async () => {
    setIsSimulating(true);
    try {
      const res = await simulateTestSale(platform);
      if (res.ok) {
        toast.success(`Pedido de teste criado via ${platform}! Lançamento financeiro gerado com sucesso.`);
        // Refresh integration last sync
        setIntegration(prev => ({ ...prev, last_synced_at: new Date().toISOString() }));
      } else {
        toast.error("Erro na simulação: " + res.error);
      }
    } catch (err) {
      toast.error("Erro ao simular: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSimulating(false);
    }
  };

  const headerBanner = (
    <div className="mb-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-md ${integration.is_enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
            <Plug size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text">{platform} Integration Hub</h2>
              <Badge variant={integration.is_enabled ? "default" : "secondary"}>
                {integration.is_enabled ? "Integração Ativa" : "Pendente de Conexão"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {integration.last_synced_at
                ? `Último pedido sincronizado: ${new Date(integration.last_synced_at).toLocaleString("pt-BR")}`
                : "Nenhum pedido sincronizado recentemente."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsConfigOpen(true)}
            className="text-xs"
          >
            <KeyRound size={13} className="mr-1.5" />
            Configurar Credenciais
          </Button>

          <Button
            size="sm"
            onClick={handleSimulateSale}
            disabled={isSimulating}
            className="bg-accent text-white hover:bg-accent-hover text-xs"
          >
            {isSimulating ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Zap size={13} className="mr-1.5" />}
            Simular Pedido de Teste
          </Button>
        </div>
      </div>

      {isConfigOpen && (
        <form onSubmit={handleSaveConfig} className="mt-4 border-t border-border pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-text">{currentLabels.label1}</label>
              <input
                type="text"
                value={keyField1}
                onChange={(e) => setKeyField1(e.target.value)}
                placeholder="Informe o ID ou Chave"
                className="mt-1 w-full rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text">{currentLabels.label2}</label>
              <input
                type="password"
                value={keyField2}
                onChange={(e) => setKeyField2(e.target.value)}
                placeholder="Informe a Chave Secreta ou Token"
                className="mt-1 w-full rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-xs text-text outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="enableChannel"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="rounded border-border text-accent focus:ring-accent"
            />
            <label htmlFor="enableChannel" className="text-xs text-text font-medium">
              Ativar recepção automática de vendas via Webhook para {platform}
            </label>
          </div>

          <div className="mt-3 rounded-md bg-surface-elevated p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text">URL do Webhook Exclusivo:</span>
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="flex items-center gap-1 text-accent hover:underline font-medium"
              >
                <Copy size={12} /> Copiar URL
              </button>
            </div>
            <code className="mt-1 block overflow-x-auto text-[11px] text-muted-foreground bg-bg p-1.5 rounded border border-border">
              {webhookUrl}
            </code>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" type="button" variant="ghost" onClick={() => setIsConfigOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" type="submit" disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <SalesClient
      platform={platform}
      title={title}
      subtitle={subtitle}
      initialSales={initialSales}
      byPlatform={[]}
      productOptions={productOptions}
      contactOptions={contactOptions}
      channelOptions={channelOptions}
      banner={headerBanner}
    />
  );
}
