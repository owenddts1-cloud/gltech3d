"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { resetPasswordAction } from "@/app/actions/auth/resetPassword";

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("As duas senhas não são iguais.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    startTransition(async () => {
      const res = await resetPasswordAction(token, password);
      if (res.ok) {
        // `replace`: o token já foi usado, e deixá-lo no histórico só produziria
        // um "voltar" que mostra erro de link inválido.
        router.replace("/app/dashboard");
        router.refresh();
        return;
      }
      setError(
        res.error === "invalid_or_expired"
          ? "Este link expirou. Peça um novo em Esqueci minha senha."
          : (res.message ?? "Não consegui trocar sua senha. Tente de novo."),
      );
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-lg font-semibold text-foreground">Criar nova senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Para a conta <strong className="text-foreground">{email}</strong>.
      </p>

      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Repita a senha</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full gap-2" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar e entrar
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </form>
  );
}
