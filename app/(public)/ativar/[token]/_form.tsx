"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activateAccountAction } from "@/app/actions/pro/activateAccount";

const MIN_PASSWORD_LENGTH = 10;

export function ActivateForm({ token, email }: { token: string; email: string }) {
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
      const res = await activateAccountAction(token, password);
      if (res.ok) {
        // `replace` e não `push`: o token já foi usado, e deixá-lo no histórico
        // só produziria um "voltar" que mostra erro de link inválido.
        router.replace("/app/dashboard");
        router.refresh();
        return;
      }
      setError(
        res.error === "invalid_or_expired"
          ? "Este link expirou. Peça um novo no WhatsApp."
          : res.error === "not_approved"
            ? "Este pedido ainda não foi liberado. Se você já pagou, me chame no WhatsApp."
            : res.error === "account_exists"
              ? "Já existe uma conta com este e-mail — este link não troca senha. Entre com a sua senha atual em /login ou use “Esqueci minha senha” para receber o link no seu e-mail."
              : (res.message ?? "Não consegui ativar sua conta. Tente de novo."),
      );
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-lg font-semibold text-foreground">Seu Calc3D PRO está liberado</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Defina uma senha para entrar com <strong className="text-foreground">{email}</strong>.
      </p>

      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
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
          Criar senha e entrar
        </Button>
      </div>
    </form>
  );
}
