import type { AuthUser, ActiveOrg } from "./types";

/**
 * Contas oficiais de e-mail da diretoria com prerrogativa administrativa.
 */
export const DIRECTORATE_EMAILS = [
  "diretoria@gltech3d.com.br",
  "diretoria.gltech@gmail.com",
  "owenddts1@gmail.com",
  "owendds1@gmail.com",
] as const;

/**
 * Checa se um e-mail pertence ao rol oficial da diretoria (suporta sub-endereçamento +tag).
 */
export function isDirectorateEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const baseEmail = normalized.replace(/\+[^@]+@/, "@");
  return DIRECTORATE_EMAILS.some((dir) => {
    const d = dir.toLowerCase();
    return normalized === d || baseEmail === d;
  });
}

export interface LandingAdminCheckOptions {
  user: AuthUser;
  activeOrg?: ActiveOrg | null;
  activeOrgSlug?: string | null;
}

/**
 * Validação estrita de autorização para o CMS da Landing Page oficial.
 *
 * Apenas têm permissão:
 * 1. Super-Admins de plataforma (`user.is_platform_admin === true`).
 * 2. Contas oficiais da Diretoria (`isDirectorateEmail(user.email)`) desde que não rebaixadas.
 * 3. Usuários com cargo `admin` na organização dona da landing (`activeOrgSlug === LANDING_ORG_SLUG`).
 *
 * Qualquer cliente PRO em organização própria (ex: Calc3D PRO) recebe `false`.
 */
export function isLandingAdmin({
  user,
  activeOrg,
  activeOrgSlug,
}: LandingAdminCheckOptions): boolean {
  if (user.is_platform_admin) return true;

  if (isDirectorateEmail(user.email)) {
    if (activeOrg && activeOrg.role !== "admin") return false;
    return true;
  }

  const landingSlug =
    process.env.LANDING_ORG_SLUG ||
    process.env.NEXT_PUBLIC_LANDING_ORG_SLUG ||
    "gltech3d";
  if (activeOrgSlug && activeOrgSlug === landingSlug && activeOrg?.role === "admin") {
    return true;
  }

  return false;
}

/**
 * Assegura que o usuário atual possui privilégios de edição da vitrine pública.
 * Dispara exceção com código 403 caso negado.
 */
export function assertLandingAdmin(opts: LandingAdminCheckOptions): void {
  if (!isLandingAdmin(opts)) {
    throw new Error("403 Forbidden: Apenas a diretoria da GLTech3D pode alterar a vitrine pública.");
  }
}
