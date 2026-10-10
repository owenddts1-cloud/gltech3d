"use client";

import { useState, useEffect } from "react";
import {
  Robot,
  Play,
  CheckCircle,
  Warning,
  Sparkle,
  PlugsConnected,
  Plus,
  MagnifyingGlass,
  Key,
  DownloadSimple,
  Copy,
  ArrowsClockwise,
  ArrowUpRight,
  Globe,
  Lightning,
  Clock,
  FolderOpen,
} from "@/lib/ui/icons";
import { N8N_DEMO_LOGS, N8N_DEMO_WORKFLOWS } from "@/lib/n8n/client";
import { getTemplatesFromPackage } from "@/lib/n8n/templates";
import { AutoHealingModal } from "@/components/automations/AutoHealingModal";
import type { N8nWorkflowStatus, N8nExecutionLog, N8nTemplateItem } from "@/types/hub";
import { toast } from "sonner";

const N8N_INSTANCE_URL = "https://n8n-636f.onrender.com";
const N8N_ACTIVE_WORKFLOW_URL = "https://n8n-636f.onrender.com/workflow/3B6VULNjIV9yKeQQ";
const N8N_KEEPALIVE_WEBHOOK = "https://n8n-636f.onrender.com/webhook/a7a52aba-ec0b-4c3c-a75a-4e9c65d6b123";
const CRONJOB_CONSOLE_URL = "https://console.cron-job.org/jobs/8619437";

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<"workflows" | "logs" | "templates" | "playground" | "secrets">("workflows");
  const [workflows, setWorkflows] = useState<(N8nWorkflowStatus & { url?: string })[]>([]);
  const [logs, setLogs] = useState<N8nExecutionLog[]>([]);
  const [templates, setTemplates] = useState<N8nTemplateItem[]>([]);
  const [selectedLogForHealing, setSelectedLogForHealing] = useState<N8nExecutionLog | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Webhook Ping & Test State
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{
    success: boolean;
    statusCode?: number;
    responseTimeMs?: number;
    message?: string;
    error?: string;
  } | null>(null);

  // Playground state
  const [webhookUrl, setWebhookUrl] = useState(N8N_KEEPALIVE_WEBHOOK);
  const [testPayload, setTestPayload] = useState('{\n  "source": "GLTech3D CRM",\n  "event": "LEAD_CREATED",\n  "phone": "553199284834",\n  "notes": "Teste de integração n8n"\n}');
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  useEffect(() => {
    setWorkflows(N8N_DEMO_WORKFLOWS);
    setLogs(N8N_DEMO_LOGS);
    setTemplates(getTemplatesFromPackage());
  }, []);

  const handlePingKeepAlive = async () => {
    setIsPinging(true);
    try {
      const res = await fetch("/api/n8n/ping-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: N8N_KEEPALIVE_WEBHOOK }),
      });
      const data = await res.json();
      setPingResult(data);

      if (data.success) {
        toast.success(`Webhook respondendo em ${data.responseTimeMs}ms! (HTTP ${data.statusCode})`);
      } else {
        toast.warning(data.error || "O webhook respondeu com erro ou o container está acordando.");
      }
    } catch (err: any) {
      setPingResult({ success: false, error: err.message });
      toast.error("Falha ao disparar ping no webhook.");
    } finally {
      setIsPinging(false);
    }
  };

  const handleRunTrigger = async (targetId: string) => {
    try {
      JSON.parse(testPayload);
    } catch {
      setTriggerResult("Erro: o JSON do payload está malformado.");
      toast.error("JSON malformado no playground.");
      return;
    }

    setIsTestingWebhook(true);
    setTriggerResult("Disparando requisição contra o webhook...");
    try {
      const res = await fetch("/api/n8n/ping-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setTriggerResult(`✅ Sucesso! HTTP ${data.statusCode} em ${data.responseTimeMs}ms.`);
        toast.success("Webhook disparado e respondido com sucesso!");
      } else {
        setTriggerResult(`⚠️ Retorno HTTP ${data.statusCode || 500} em ${data.responseTimeMs}ms: ${data.error}`);
        toast.warning("Webhook retornou erro ou status diferente de 200.");
      }
    } catch (err: any) {
      setTriggerResult(`❌ Falha de rede: ${err.message}`);
      toast.error(err.message);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleCopyTemplateJson = (tmpl: N8nTemplateItem) => {
    const content = JSON.stringify(tmpl.jsonContent, null, 2);
    navigator.clipboard.writeText(content);
    toast.success(`Template '${tmpl.title}' copiado! No n8n, pressione Ctrl+V para colar o fluxo.`);
  };

  const handleDownloadTemplateJson = (tmpl: N8nTemplateItem) => {
    const content = JSON.stringify(tmpl.jsonContent, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tmpl.id || "workflow-template"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Arquivo ${tmpl.id}.json baixado com sucesso!`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header com Atalhos Diretos ao n8n */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 font-bold">
              <Robot size={20} />
            </span>
            <h1 className="text-xl font-bold text-foreground">Central de Automações n8n</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Render Cloud
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Instância oficial n8n hospedada no Render com PostgreSQL no Supabase e manutenção 24/7.
          </p>
        </div>

        {/* Botões de Ação Rápida — Abre o n8n direto do CRM */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={N8N_INSTANCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-cyan-500/20 hover:opacity-95 transition-all hover:scale-[1.02]"
            title="Acessar o painel Web do n8n na nuvem"
          >
            <Globe size={15} weight="bold" />
            <span>Abrir n8n Web</span>
            <ArrowUpRight size={13} weight="bold" />
          </a>

          <a
            href={N8N_ACTIVE_WORKFLOW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors"
            title="Abrir o editor do Workflow ativo diretamente no n8n"
          >
            <Lightning size={14} weight="bold" />
            <span>Workflow Ativo</span>
            <ArrowUpRight size={13} />
          </a>

          <a
            href={CRONJOB_CONSOLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            title="Gerenciar o robô de Keep-Alive a cada 5min no cron-job.org"
          >
            <Clock size={14} />
            <span>cron-job.org</span>
            <ArrowUpRight size={13} />
          </a>
        </div>
      </div>

      {/* Card Especial de Conexão e Monitoramento da Instância n8n Cloud */}
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-zinc-950 to-card p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <PlugsConnected size={20} weight="bold" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Status da Instância Cloud & Webhooks</h3>
              <p className="text-[11px] text-muted-foreground">
                Hospedado no Render • Banco dedicado Supabase Postgres • Keep-Alive a cada 5 minutos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePingKeepAlive}
            disabled={isPinging}
            className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-zinc-950 shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
          >
            <ArrowsClockwise size={14} className={isPinging ? "animate-spin" : ""} />
            <span>{isPinging ? "Verificando..." : "Testar Webhook Keep-Alive"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-border bg-zinc-950/60 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">URL Web do n8n</span>
            <p className="font-mono text-cyan-400 truncate">{N8N_INSTANCE_URL}</p>
            <span className="text-[10px] text-muted-foreground block">Web Service no Render</span>
          </div>

          <div className="rounded-xl border border-border bg-zinc-950/60 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Webhook de Manutenção</span>
            <p className="font-mono text-emerald-400 truncate">.../webhook/780020eb...</p>
            <span className="text-[10px] text-muted-foreground block">Ativado pelo cron-job.org a cada 5 min</span>
          </div>

          <div className="rounded-xl border border-border bg-zinc-950/60 p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Banco Supabase (Postgres)</span>
            <p className="font-mono text-purple-400 truncate">aws-1-us-west-2.pooler...:5432</p>
            <span className="text-[10px] text-muted-foreground block">Session pooler dedicado na porta 5432</span>
          </div>
        </div>

        {/* Retorno do Ping */}
        {pingResult && (
          <div
            className={`rounded-xl p-3 text-xs flex items-center justify-between border ${
              pingResult.success
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-amber-500/10 border-amber-500/20 text-amber-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{pingResult.success ? "🟢" : "⚠️"}</span>
              <span>
                {pingResult.success
                  ? `Webhook online e respondendo em ${pingResult.responseTimeMs}ms!`
                  : `Retorno do teste: ${pingResult.error || "Código HTTP " + pingResult.statusCode}`}
              </span>
            </div>
            {pingResult.statusCode && (
              <span className="font-mono text-[10px] bg-black/40 px-2 py-0.5 rounded font-bold">
                HTTP {pingResult.statusCode}
              </span>
            )}
          </div>
        )}

        {/* Link para a pasta de Templates no Workspace */}
        <div className="flex items-center justify-between rounded-xl bg-cyan-950/30 border border-cyan-500/20 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-cyan-300">
            <FolderOpen size={16} />
            <span>
              Pasta local de templates: <strong>services/n8n/templates/</strong> (adicione arquivos .json, .zip ou .txt aqui para o agente analisar)
            </span>
          </div>
          <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded">
            Workspace
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveTab("workflows")}
          className={`px-3 py-2 font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === "workflows"
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Workflows ({workflows.length})
        </button>

        <button
          onClick={() => setActiveTab("templates")}
          className={`px-3 py-2 font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === "templates"
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Biblioteca de Templates ({templates.length})
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`px-3 py-2 font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === "logs"
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Logs & Auto-Healing ({logs.length})
        </button>

        <button
          onClick={() => setActiveTab("playground")}
          className={`px-3 py-2 font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === "playground"
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Webhook Playground
        </button>

        <button
          onClick={() => setActiveTab("secrets")}
          className={`px-3 py-2 font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === "secrets"
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Secrets Vault (Cofre)
        </button>
      </div>

      {/* Tab: Workflows */}
      {activeTab === "workflows" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className={`flex flex-col justify-between rounded-xl bg-card border p-4 shadow-sm hover:border-cyan-500/40 transition-all space-y-4 ${
                wf.url ? "border-cyan-500/40 bg-cyan-950/10" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span>{wf.name}</span>
                    {wf.url && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        Ativo na Nuvem
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">ID: {wf.id}</p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    wf.active
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                  }`}
                >
                  {wf.active ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
                <span className="text-muted-foreground">Atualizado: {wf.updatedAt}</span>
                <div className="flex items-center gap-2">
                  {wf.url ? (
                    <a
                      href={wf.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-cyan-400 font-bold hover:underline"
                    >
                      <span>Abrir no n8n</span>
                      <ArrowUpRight size={12} />
                    </a>
                  ) : (
                    <button
                      onClick={() => handleRunTrigger(wf.id)}
                      className="flex items-center gap-1 text-cyan-400 font-semibold hover:underline"
                    >
                      <Play size={12} />
                      <span>Simular</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Templates */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
            <div className="relative flex-1 w-full">
              <MagnifyingGlass size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar entre os templates (ex: WhatsApp, Evolution API, Keep-Alive, Discord, Sheets)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 pl-9 pr-4 py-2 text-xs text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg bg-zinc-950 border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 w-full sm:w-auto"
            >
              <option value="all">Todas Categorias ({templates.length} templates)</option>
              {Array.from(new Set(templates.map((t) => t.category))).sort().map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates
              .filter((tmpl) => {
                const matchesSearch =
                  tmpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  tmpl.category.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesCategory = selectedCategory === "all" || tmpl.category === selectedCategory;
                return matchesSearch && matchesCategory;
              })
              .map((tmpl) => {
                const isWorkspace = tmpl.category.includes("GLTech Workspace");
                return (
                  <div
                    key={tmpl.id}
                    className={`flex flex-col justify-between rounded-xl bg-card border p-5 space-y-4 shadow-sm hover:border-cyan-500/40 transition-colors ${
                      isWorkspace ? "border-cyan-500/40 bg-gradient-to-br from-cyan-950/20 to-card" : "border-border"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            isWorkspace
                              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                              : "bg-zinc-800 text-zinc-300 border-border"
                          }`}
                        >
                          {tmpl.category}
                        </span>
                        {isWorkspace && (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            Pronto para Uso
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-foreground mt-2">{tmpl.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tmpl.description}</p>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleCopyTemplateJson(tmpl)}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                        title="Copiar JSON para colar com Ctrl+V no n8n"
                      >
                        <Copy size={13} />
                        <span>Copiar JSON</span>
                      </button>

                      <button
                        onClick={() => handleDownloadTemplateJson(tmpl)}
                        className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:opacity-90 transition-opacity"
                        title="Baixar arquivo de workflow .json"
                      >
                        <DownloadSimple size={13} />
                        <span>Baixar .json</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab: Logs & Auto-Healing */}
      {activeTab === "logs" && (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-card border border-border p-4 text-xs shadow-sm hover:border-border transition-colors"
            >
              <div className="flex items-center gap-3">
                {log.status === "success" ? (
                  <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                ) : (
                  <Warning size={18} className="text-red-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-foreground">{log.workflowName}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Modo: {log.mode} • Início: {new Date(log.startedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {log.status === "failed" && (
                  <button
                    onClick={() => setSelectedLogForHealing(log)}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 text-purple-300 font-bold hover:bg-purple-500/20 transition-colors"
                  >
                    <Sparkle size={12} />
                    <span>Auto-Healing IA</span>
                  </button>
                )}
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    log.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {log.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Playground */}
      {activeTab === "playground" && (
        <div className="rounded-xl bg-card border border-border p-5 space-y-4 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-foreground">Webhook & Payload Playground</h2>
            <p className="text-xs text-muted-foreground">
              Simule e teste disparos reais contra os webhooks configurados no seu n8n
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">URL do Webhook Alvo:</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://n8n-636f.onrender.com/webhook/..."
              className="w-full rounded-xl bg-zinc-950 font-mono text-xs text-cyan-400 px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Payload JSON de Teste:</label>
            <textarea
              rows={6}
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 font-mono text-xs text-cyan-400 p-3 border border-border focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={() => handleRunTrigger("webhook-test")}
              disabled={isTestingWebhook}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:opacity-90 disabled:opacity-50"
            >
              <Play size={14} />
              <span>{isTestingWebhook ? "Disparando..." : "Disparar Teste Real de Webhook"}</span>
            </button>

            {triggerResult && (
              <span className="text-xs font-mono text-cyan-300 bg-cyan-950/40 p-2 rounded border border-cyan-500/20">
                {triggerResult}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tab: Secrets Vault */}
      {activeTab === "secrets" && (
        <div className="rounded-xl bg-card border border-border p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Key size={16} className="text-amber-400" />
                <span>Cofre de Credenciais de Automação</span>
              </h2>
              <p className="text-xs text-muted-foreground">Configurações para n8n, Supabase e APIs externas</p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-border font-mono">
              <span className="text-muted-foreground">N8N_HOST</span>
              <span className="text-cyan-400">n8n-636f.onrender.com</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-border font-mono">
              <span className="text-muted-foreground">DB_POSTGRESDB_HOST</span>
              <span className="text-purple-400">aws-1-us-west-2.pooler.supabase.com:5432</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-border font-mono">
              <span className="text-muted-foreground">CRONJOB_SCHEDULE</span>
              <span className="text-emerald-400">*/5 * * * * (a cada 5 minutos)</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Auto-Healing */}
      <AutoHealingModal
        log={selectedLogForHealing}
        onClose={() => setSelectedLogForHealing(null)}
      />
    </div>
  );
}
