import type { Metadata } from "next";
import { verifyInviteToken } from "@/lib/auth/invite-token";
import { ActivateForm } from "./_form";
import { getStoreWhatsapp } from "@/lib/landing/whatsapp";
import { formatWhatsappDisplay, storeWhatsappUrl } from "@/lib/landing/whatsapp-number";

export const metadata: Metadata = {
  title: "Ativar meu acesso — Calc3D PRO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Página de ativação do comprador do Calc3D PRO.
 *
 * Pública por necessidade: quem abre este link ainda NÃO tem conta — exigir
 * sessão aqui tornaria a ativação impossível. A credencial é o token assinado
 * no caminho, verificado aqui (para dar erro cedo) e DE NOVO na server action,
 * que é onde a decisão vale.
 */
export default async function AtivarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = verifyInviteToken(token);

  if (!payload) {
    const storeWhatsapp = await getStoreWhatsapp();
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">Link inválido ou expirado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Links de ativação valem por 7 dias. Fale no WhatsApp{" "}
          <a
            href={storeWhatsappUrl(storeWhatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            {formatWhatsappDisplay(storeWhatsapp)}
          </a>{" "}
          que eu gero um novo.
        </p>
      </div>
    );
  }

  return <ActivateForm token={token} email={payload.email} />;
}
