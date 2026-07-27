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
} from "@/lib/ui/icons";
import { N8N_DEMO_LOGS, N8N_DEMO_WORKFLOWS } from "@/lib/n8n/client";
import { DemoBanner } from "@/components/app/DemoBanner";
import { getTemplatesFromPackage } from "@/lib/n8n/templates";
import { AutoHealingModal } from "@/components/automations/AutoHealingModal";
import type { N8nWorkflowStatus, N8nExecutionLog, N8nTemplateItem } from "@/types/hub";

export default function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<"workflows" | "logs" | "templates" | "playground" | "secrets">("workflows");
  const [workflows, setWorkflows] = useState<N8nWorkflowStatus[]>([]);
  const [logs, setLogs] = useState<N8nExecutionLog[]>([]);
  const [templates, setTemplates] = useState<N8nTemplateItem[]>([]);
  const [selectedLogForHealing, setSelectedLogForHealing] = useState<N8nExecutionLog | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Playground state
  const [testPayload, setTestPayload] = useState('{\n  "clientId": "CLI-1092",\n  "name": "Empresa Exemplo LTDA",\n  "action": "CREATE_ORDER"\n}');
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  useEffect(() => {
    setWorkflows(N8N_DEMO_WORKFLOWS);
    setLogs(N8N_DEMO_LOGS);
    setTemplates(getTemplatesFromPackage());
  }, []);

  /**
   * O disparo real foi removido junto com `/api/n8n/trigger`.
   *
   * Aquela rota encaminhava para uma URL vinda do corpo da requisição e anexava
   * a `N8N_API_KEY` no cabeçalho — qualquer usuário autenticado, de qualquer
   * tenant, extraía a chave ou varria a rede interna. Enquanto a integração não
   * for construída de verdade (credencial por tenant + allowlist de destino),
   * o playground apenas valida o JSON e diz o que ainda falta.
   */
  const handleRunTrigger = (id: string) => {
    try {
      JSON.parse(testPayload);
    } catch {
      setTriggerResult("Erro: o JSON do playground está malformado.");
      return;
    }
    setTriggerResult(
      `Payload válido para '${id}'. O disparo real ainda não está disponível — a integração com o n8n está em construção.`,
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <DemoBanner>
        Os workflows, execuções e logs abaixo são exemplos fixos. A integração com o n8n ainda
        não está construída — o disparo real foi desativado.
      </DemoBanner>

      {/* Header do App 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Robot className="text-cyan-500" size={24} />
            <span>Automações n8n Workspace</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gestão unificada de workflows, monitoramento de execuções, templates e Auto-Healing IA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("playground")}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20 transition-colors"
          >
            <Play size={14} />
            <span>Webhook Playground</span>
          </button>
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
          onClick={() => setActiveTab("playground")}
          className={`px-3 py-2 font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === "playground"
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Payload Playground
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
              className="flex flex-col justify-between rounded-xl bg-card border border-border p-4 shadow-sm hover:border-cyan-500/40 transition-all space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span>{wf.name}</span>
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
                <span className="text-muted-foreground">Última atualização: {wf.updatedAt}</span>
                <button
                  onClick={() => handleRunTrigger(wf.id)}
                  className="flex items-center gap-1 text-cyan-400 font-semibold hover:underline"
                >
                  <Play size={12} />
                  <span>Executar</span>
                </button>
              </div>
            </div>
          ))}
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

      {/* Tab: Templates */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
            <div className="relative flex-1 w-full">
              <MagnifyingGlass size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar entre 328 templates (ex: AI, WhatsApp, Gmail, Sheets, Discord)..."
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
              <option value="all">Todas Categorias (328 templates)</option>
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
              .slice(0, 40)
              .map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="flex flex-col justify-between rounded-xl bg-card border border-border p-5 space-y-4 shadow-sm hover:border-cyan-500/40 transition-colors"
                >
                  <div>
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                      {tmpl.category}
                    </span>
                    <h3 className="text-sm font-bold text-foreground mt-2">{tmpl.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tmpl.description}</p>
                  </div>

                  <div className="pt-3 border-t border-border flex justify-end">
                    <button
                      onClick={() => alert(`Template '${tmpl.title}' clonado com sucesso para o seu n8n!`)}
                      className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:opacity-90 transition-opacity"
                    >
                      <DownloadSimple size={14} />
                      <span>Clonar Workflow</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tab: Playground */}
      {activeTab === "playground" && (
        <div className="rounded-xl bg-card border border-border p-5 space-y-4 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-foreground">Webhook & Payload Playground</h2>
            <p className="text-xs text-muted-foreground">Simule o envio de eventos do CRM para testar fluxos n8n</p>
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

          <div className="flex items-center justify-between">
            <button
              onClick={() => handleRunTrigger("wf_1")}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:opacity-90"
            >
              <Play size={14} />
              <span>Simular Disparo de Webhook</span>
            </button>

            {triggerResult && (
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
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
                <span>Cofre Unificado de Credenciais (Secrets Vault)</span>
              </h2>
              <p className="text-xs text-muted-foreground">Chaves centralizadas para n8n, Supabase, OpenAI e ElevenLabs</p>
            </div>
            <button
              onClick={() => alert("Adicionar nova chave ao Cofre")}
              className="flex items-center gap-1 rounded-lg bg-border px-3 py-1.5 text-xs text-foreground font-semibold hover:bg-muted"
            >
              <Plus size={14} />
              <span>Nova Chave</span>
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-border font-mono">
              <span className="text-muted-foreground">N8N_API_KEY</span>
              <span className="text-emerald-400">n8n_api_••••••••••••••••3a9b</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-border font-mono">
              <span className="text-muted-foreground">OPENAI_API_KEY</span>
              <span className="text-emerald-400">sk-proj-••••••••••••••••99f2</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-border font-mono">
              <span className="text-muted-foreground">ELEVENLABS_API_KEY</span>
              <span className="text-emerald-400">el_live_••••••••••••••••104c</span>
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
