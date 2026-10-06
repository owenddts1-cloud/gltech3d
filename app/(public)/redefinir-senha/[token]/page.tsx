import type { Metadata } from "next";
import Link from "next/link";
import { verifyPasswordResetToken } from "@/lib/auth/password-reset-token";
import { ResetPasswordForm } from "./_form";

export const metadata: Metadata = {
  title: "Criar nova senha — GLTECH CRM",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Pública por necessidade: quem abre este link não consegue entrar — é o ponto.
 * A credencial é o token assinado no caminho, verificado aqui para errar cedo e
 * DE NOVO na server action, que é onde a decisão vale.
 */
export default async function RedefinirSenhaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = verifyPasswordResetToken(token);

  if (!payload) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">Link inválido ou expirado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Links de redefinição valem por uma hora.{" "}
          <Link href="/esqueci-senha" className="font-medium underline">
            Peça um novo
          </Link>
          .
        </p>
      </div>
    );
  }

  return <ResetPasswordForm token={token} email={payload.email} />;
}
