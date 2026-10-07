import type { Metadata } from "next";
import Link from "next/link";
import { verifyPasswordResetToken } from "@/lib/auth/password-reset-token";
import { ResetPasswordForm } from "./[token]/_form";

export const metadata: Metadata = {
  title: "Redefinir Senha — GLTech3D",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RedefinirSenhaQueryPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center max-w-md mx-auto my-12">
        <h1 className="text-lg font-semibold text-foreground">Token não informado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O link de recuperação está incompleto.{" "}
          <Link href="/esqueci-senha" className="font-medium underline text-amber-500">
            Solicite um novo link
          </Link>
          .
        </p>
      </div>
    );
  }

  const payload = verifyPasswordResetToken(token);

  if (!payload) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center max-w-md mx-auto my-12">
        <h1 className="text-lg font-semibold text-foreground">Link inválido ou expirado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Links de redefinição valem por uma hora.{" "}
          <Link href="/esqueci-senha" className="font-medium underline text-amber-500">
            Peça um novo link
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-12">
      <ResetPasswordForm token={token} email={payload.email} />
    </div>
  );
}
