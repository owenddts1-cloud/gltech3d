/**
 * Fonte única dos apps do hub (CRM / Automações / Criação de Conteúdo).
 * Usada por /portal e pelo AppSwitcher — nunca duplicar essa lista.
 */
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Gauge, Robot, VideoCamera } from "@/lib/ui/icons";

export type AppId = "crm" | "automations" | "content-studio";
export type AppStatus = "available" | "coming-soon";

export interface AppDefinition {
  id: AppId;
  label: string;
  shortLabel: string;
  description: string;
  icon: PhosphorIcon;
  href: string;
  status: AppStatus;
}

export const APPS: AppDefinition[] = [
  {
    id: "crm",
    label: "CRM",
    shortLabel: "CRM",
    description: "Atendimento, vendas, produção e impressão 3D num só painel.",
    icon: Gauge,
    href: "/app/dashboard",
    status: "available",
  },
  {
    id: "automations",
    label: "Automações (n8n)",
    shortLabel: "Automações",
    description: "Hub de gestão de workflows, execuções e automações via n8n.",
    icon: Robot,
    href: "/automations",
    // Prévia: a integração com o n8n não existe. As telas mostram dados de
    // demonstração e as rotas de API que as serviam foram removidas (a de
    // disparo encaminhava para uma URL do corpo da requisição anexando a
    // N8N_API_KEY). Volta a "available" quando houver integração real.
    status: "coming-soon",
  },
  {
    id: "content-studio",
    label: "Criação de Conteúdo",
    shortLabel: "Conteúdo",
    description: "Estúdio de vídeos, áudio, transcrições e mídias criativas com IA.",
    icon: VideoCamera,
    href: "/content-studio",
    // Prévia: não há backend de geração. A rota que existia devolvia roteiro
    // fixo e URLs de vídeo inexistentes, sempre com success: true.
    status: "coming-soon",
  },
];

export function getAppById(id: AppId): AppDefinition | undefined {
  return APPS.find((a) => a.id === id);
}

/** Resolve qual app está "ativo" a partir do pathname atual. */
export function resolveActiveAppId(pathname: string): AppId | null {
  if (pathname.startsWith("/automations") || pathname.startsWith("/app/automations")) return "automations";
  if (pathname.startsWith("/app")) return "crm";
  if (pathname.startsWith("/content-studio")) return "content-studio";
  return null;
}
