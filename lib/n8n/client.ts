import type { N8nWorkflowStatus, N8nExecutionLog } from "@/types/hub";

/**
 * Dados de demonstração do módulo de Automações.
 *
 * Isto NÃO é um cliente de n8n — e a versão anterior também não era, embora
 * parecesse. Ela rodava dentro de um componente `"use client"` e decidia entre
 * "real" e "mock" lendo `process.env.N8N_API_KEY`, que é uma variável
 * server-only: no browser sempre vale `undefined`, então o caminho real nunca
 * era alcançável e todo retorno já vinha daqui. Pior, `triggerWorkflow` devolvia
 * `{ success: true }` **dentro do catch** — falha de rede virava sucesso na tela.
 *
 * Enquanto a integração de verdade não existir (credencial por tenant, allowlist
 * de destino e chamada a partir do servidor), este módulo entrega apenas o
 * conjunto fixo de exemplos que alimenta a prévia, e a UI diz que é demonstração.
 */
export const N8N_DEMO_WORKFLOWS: N8nWorkflowStatus[] = [
  { id: "wf_1", name: "Lead CRM -> WhatsApp Notification", active: true, createdAt: "2026-07-01", updatedAt: "2026-07-20", lastExecutionStatus: "success" },
  { id: "wf_2", name: "Shopee Orders Sync -> Impressão 3D OS", active: true, createdAt: "2026-07-05", updatedAt: "2026-07-22", lastExecutionStatus: "success" },
  { id: "wf_3", name: "AI Studio Video -> Post Auto Instagram", active: false, createdAt: "2026-07-10", updatedAt: "2026-07-15", lastExecutionStatus: "error" },
  { id: "wf_4", name: "Relatório Financeiro Semanal Discord", active: true, createdAt: "2026-07-12", updatedAt: "2026-07-21", lastExecutionStatus: "success" },
];

export const N8N_DEMO_LOGS: N8nExecutionLog[] = [
  {
    id: "log_101",
    workflowId: "wf_1",
    workflowName: "Lead CRM -> WhatsApp Notification",
    mode: "webhook",
    status: "success",
    startedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    stoppedAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    inputPayload: { clientName: "João Silva", phone: "11999998888" },
    outputData: { messageSent: true },
  },
  {
    id: "log_102",
    workflowId: "wf_3",
    workflowName: "AI Studio Video -> Post Auto Instagram",
    mode: "manual",
    status: "failed",
    startedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    stoppedAt: new Date(Date.now() - 1000 * 60 * 59).toISOString(),
    inputPayload: { videoUrl: "https://exemplo.invalid/v/sample.mp4" },
    errorStackTrace: "Error 401 Unauthorized: Instagram Access Token Expired.",
    aiDiagnosticSuggestion:
      "O token de acesso do Instagram OAuth expirou. Renove a credencial 'Instagram_OAuth2' no Secrets Vault ou reconecte a conta.",
  },
];
