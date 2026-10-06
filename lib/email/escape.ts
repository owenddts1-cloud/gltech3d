/**
 * Escapa texto para interpolação segura em corpo HTML de e-mail.
 *
 * Vivia privado em `templates/lead-notify.ts`. Foi extraído quando o segundo
 * template precisou dele: uma terceira cópia é como uma delas acaba esquecendo o
 * `&` e deixando passar markup vindo de um formulário público.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
