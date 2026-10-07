export interface SettingsLink {
  href: string;
  title: string;
  description: string;
  isPlatformOrDirectorOnly?: boolean;
}

/**
 * Links disponíveis na central de configurações (/app/settings).
 * Módulos sensíveis como API Tokens, Pipelines e Audit Log são restritos
 * exclusivamente à Diretoria da GLTech3D e Super-Admins.
 */
export const SETTINGS_LINKS: SettingsLink[] = [
  { href: "/app/settings/profile", title: "Perfil", description: "Nome, idioma, fuso, avatar." },
  {
    href: "/app/settings/security",
    title: "Segurança",
    description: "MFA, códigos de recuperação, dispositivos confiáveis e biometria.",
  },
  {
    href: "/app/settings/notifications",
    title: "Notificações",
    description: "Preferências de alertas e canais.",
  },
  {
    href: "/app/settings/billing",
    title: "Plano e cobrança",
    description: "Plano atual, dias de trial e faturas.",
  },
  {
    href: "/app/settings/tenant",
    title: "Organização",
    description: "Dados da sua oficina/empresa e logo para documentos.",
  },
  {
    href: "/app/settings/tenant/whatsapp",
    title: "Conexões WhatsApp",
    description: "Configuração do seu número de atendimento.",
  },
  // Exclusivos da Diretoria / Platform Admin:
  {
    href: "/app/settings/api-tokens",
    title: "API Tokens",
    description: "Tokens server-to-server.",
    isPlatformOrDirectorOnly: true,
  },
  {
    href: "/app/settings/tenant/pipelines",
    title: "Pipelines",
    description: "Configuração de funis globais e etapas.",
    isPlatformOrDirectorOnly: true,
  },
  {
    href: "/app/audit",
    title: "Audit Log",
    description: "Histórico completo de auditoria do sistema.",
    isPlatformOrDirectorOnly: true,
  },
];

export interface SettingsFilterOptions {
  isDirectorOrPlatformAdmin: boolean;
}

/**
 * Filtra a lista de cards de configurações.
 * Para usuários comuns (não-diretoria), expõe apenas o pacote básico:
 * Perfil, Segurança, Notificações, Plano e Cobrança, Organização e WhatsApp.
 */
export function filterSettingsLinks(
  links: SettingsLink[],
  { isDirectorOrPlatformAdmin }: SettingsFilterOptions,
): SettingsLink[] {
  if (isDirectorOrPlatformAdmin) return links;
  return links.filter((l) => !l.isPlatformOrDirectorOnly);
}
