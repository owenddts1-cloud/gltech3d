import { redirect } from "next/navigation";

/**
 * Entrada do hub.
 *
 * Aqui existia uma tela de "login por token" que aceitava **qualquer string de
 * 4 caracteres**, gravava o valor em `localStorage` e redirecionava — enquanto o
 * rodapé anunciava "Autenticação Criptografada (AES-256)". Não havia criptografia
 * alguma, e a autenticação de verdade nunca dependeu dela: o `PortalLayout` já
 * resolve a sessão com `loadAppShellContext()`, e o middleware barra quem não
 * estiver logado antes de a página renderizar.
 *
 * A tela não protegia nada e afirmava proteger. Foi removida: quem chega aqui já
 * está autenticado e segue direto para o seletor de apps.
 */
export default function PortalPage() {
  redirect("/portal/switcher");
}
