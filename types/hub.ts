export type AppDomain = "crm" | "automations" | "content-studio";

export interface UserTokenSession {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "operator" | "viewer";
  };
  activeApp: AppDomain;
  expiresAt: string;
}

// Payload do Barramento Inter-Apps (Cross-App Data Mesh)
export type MeshPayloadType = 
  | "CRM_TO_CONTENT"        // Produto 3D / O.S. -> AI Studio (MoneyPrinter)
  | "CRM_TO_AUTOMATION"     // Clientes / Pedidos O.S. -> n8n Workflow Trigger
  | "CONTENT_TO_CRM"        // Vídeo/Roteiro AI Studio -> Produto 3D / Campanha CRM
  | "CONTENT_TO_AUTOMATION" // Vídeo AI Studio -> Fluxo de Postagem Social n8n
  | "AUTOMATION_TO_CRM";    // Webhook n8n -> Atualização de Status no CRM

export interface MeshPayload<T = unknown> {
  id: string;
  sourceApp: AppDomain;
  targetApp: AppDomain;
  payloadType: MeshPayloadType;
  timestamp: string;
  data: T;
  metadata?: Record<string, unknown>;
}

// Estruturas do App 2: n8n Automations Hub
export interface N8nWorkflowStatus {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  lastExecutionStatus?: "success" | "error" | "running";
}

export interface N8nExecutionLog {
  id: string;
  workflowId: string;
  workflowName: string;
  mode: "webhook" | "manual" | "trigger";
  status: "success" | "failed" | "running";
  startedAt: string;
  stoppedAt?: string;
  inputPayload?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  errorStackTrace?: string;
  aiDiagnosticSuggestion?: string; // Auto-Healing Agent
}

export interface N8nTemplateItem {
  id: string;
  title: string;
  category: string;
  description: string;
  jsonContent: object;
}

// Estruturas do App 3: AI Content Studio & MoneyPrinter
export interface CreativeAsset {
  id: string;
  title: string;
  type: "video" | "audio" | "image" | "script" | "subtitle";
  url: string;
  durationSeconds?: number;
  metadata: {
    prompt?: string;
    modelUsed?: string;
    linkedProductId?: string;
    linkedCustomerId?: string;
  };
  createdAt: string;
}

export interface MoneyPrinterJob {
  jobId: string;
  videoSubject: string;
  voiceName: string;
  bgMusic?: string;
  status: "queued" | "generating_script" | "tts" | "rendering" | "completed" | "failed";
  outputVideoUrl?: string;
  srtSubtitleUrl?: string;
}
