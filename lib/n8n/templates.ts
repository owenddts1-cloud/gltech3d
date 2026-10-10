import type { N8nTemplateItem } from "@/types/hub";
import rawTemplates from "./templates-data.json";

// Templates dedicados da pasta services/n8n/templates/
export const WORKSPACE_TEMPLATES: N8nTemplateItem[] = [
  {
    id: "tpl_gltech_achadinhos_master",
    title: "GLTech3D — Achadinhos Multicanal Master (ML, Shopee, Amazon, Sheets & WhatsApp)",
    category: "⭐ GLTech Workspace",
    description: "Automação completa inspirada no sistema Garimpa Store: mineração com cron 2h, IA para geração de copy persuasiva com cálculo De/Por, logging em planilha Google Sheets no Drive e envio em loop para grupos de WhatsApp via Evolution API com delay anti-ban.",
    jsonContent: {
      name: "GLTech3D - Achadinhos Multicanal Master",
      file: "services/n8n/templates/achadinhos-multicanal-master.json",
    },
  },
  {
    id: "tpl_gltech_bot_ofertas",
    title: "GLTech3D — Bot de Ofertas WhatsApp (Evolution API) & Telegram",
    category: "⭐ GLTech Workspace",
    description: "Workflow completo com Webhook de entrada, gerador de copy persuasiva em JavaScript, controle de delay anti-ban e nós HTTP para Evolution API e Telegram.",
    jsonContent: {
      name: "GLTech3D - Bot de Ofertas WhatsApp (Evolution API) & Telegram",
      file: "services/n8n/templates/bot-ofertas-evolution.json",
      webhookPath: "oferta-post",
    },
  },
  {
    id: "tpl_gltech_keepalive",
    title: "GLTech3D — Keep-Alive & Health Ping (cron-job.org)",
    category: "⭐ GLTech Workspace",
    description: "Webhook de alta velocidade para manutenção contínua 24/7. Responde com status HTTP 200 e timestamp ISO a cada ping do cron-job.org, impedindo a hibernação do Render.",
    jsonContent: {
      name: "GLTech3D - Keep-Alive & Health Ping (cron-job.org)",
      file: "services/n8n/templates/keepalive-monitor.json",
      webhookPath: "a7a52aba-ec0b-4c3c-a75a-4e9c65d6b123",
    },
  },
];

export const LOCAL_N8N_TEMPLATES: N8nTemplateItem[] = [
  ...WORKSPACE_TEMPLATES,
  ...rawTemplates.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    description: t.description,
    jsonContent: { name: t.title, filename: t.filename },
  })),
];

export function getTemplatesFromPackage(): N8nTemplateItem[] {
  return LOCAL_N8N_TEMPLATES;
}

export function getCategories(): string[] {
  const set = new Set(LOCAL_N8N_TEMPLATES.map((t) => t.category));
  return Array.from(set).sort();
}
