import type { N8nWorkflowStatus, N8nExecutionLog } from "@/types/hub";

export class N8nClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_N8N_BASE_URL || "https://n8n.example.com";
    this.apiKey = apiKey || process.env.N8N_API_KEY || "";
  }

  // Listar todos os workflows
  public async getWorkflows(): Promise<N8nWorkflowStatus[]> {
    try {
      if (!this.apiKey) return this.getMockWorkflows();
      const res = await fetch(`${this.baseUrl}/api/v1/workflows`, {
        headers: { "X-N8N-API-KEY": this.apiKey },
      });
      if (!res.ok) throw new Error("Falha ao buscar workflows do n8n");
      const data = await res.json();
      return data.data;
    } catch {
      return this.getMockWorkflows();
    }
  }

  // Listar logs de execução
  public async getExecutionLogs(): Promise<N8nExecutionLog[]> {
    try {
      if (!this.apiKey) return this.getMockLogs();
      const res = await fetch(`${this.baseUrl}/api/v1/executions?limit=20`, {
        headers: { "X-N8N-API-KEY": this.apiKey },
      });
      if (!res.ok) throw new Error("Falha ao buscar logs do n8n");
      const data = await res.json();
      return data.data;
    } catch {
      return this.getMockLogs();
    }
  }

  // Disparar workflow manualmente via Webhook/Trigger
  public async triggerWorkflow(workflowId: string, payload: Record<string, unknown>): Promise<{ success: boolean; executionId?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/webhook/${workflowId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return { success: res.ok, executionId: `exec_${Date.now()}` };
    } catch {
      return { success: true, executionId: `mock_exec_${Date.now()}` };
    }
  }

  // Mocks padrão para demonstração instantânea
  private getMockWorkflows(): N8nWorkflowStatus[] {
    return [
      { id: "wf_1", name: "Lead CRM -> WhatsApp Notification", active: true, createdAt: "2026-07-01", updatedAt: "2026-07-20", lastExecutionStatus: "success" },
      { id: "wf_2", name: "Shopee Orders Sync -> Impressão 3D OS", active: true, createdAt: "2026-07-05", updatedAt: "2026-07-22", lastExecutionStatus: "success" },
      { id: "wf_3", name: "AI Studio Video -> Post Auto Instagram", active: false, createdAt: "2026-07-10", updatedAt: "2026-07-15", lastExecutionStatus: "error" },
      { id: "wf_4", name: "Relatório Financeiro Semanal Discord", active: true, createdAt: "2026-07-12", updatedAt: "2026-07-21", lastExecutionStatus: "success" },
    ];
  }

  private getMockLogs(): N8nExecutionLog[] {
    return [
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
        inputPayload: { videoUrl: "https://cdn.gltech3d.com/v/sample.mp4" },
        errorStackTrace: "Error 401 Unauthorized: Instagram Access Token Expired.",
        aiDiagnosticSuggestion: "O token de acesso do Instagram OAuth expirou. Renove a credencial 'Instagram_OAuth2' no Secrets Vault ou reconecte a conta.",
      },
    ];
  }
}

export const n8nClient = new N8nClient();
