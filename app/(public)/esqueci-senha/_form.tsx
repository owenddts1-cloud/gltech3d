"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    try {
      await fetch("/api/v1/public/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // A rota responde 200 genérico de qualquer forma; falha de rede não deve
      // revelar nada nem mudar a mensagem. O usuário tenta de novo.
    } finally {
      setPending(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <MailCheck className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Confira seu e-mail</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Se existir uma conta com esse endereço, o link de redefinição chegou lá. Ele vale por uma
          hora.
        </p>
        <Button asChild variant="outline" className="mt-5 w-full">
          <Link href="/login">Voltar ao login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-lg font-semibold text-foreground">Esqueci minha senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Informe o e-mail da conta e enviamos um link para criar uma senha nova.
      </p>

      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>

        <Button type="submit" className="w-full gap-2" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enviar link
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
