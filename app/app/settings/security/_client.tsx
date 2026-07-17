"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RecoveryCodesPanel } from "@/components/auth/RecoveryCodesPanel";
import { regenerateRecoveryCodes } from "@/app/actions/settings/regenerateRecoveryCodes";
import { signOutEverywhere } from "@/app/actions/settings/signOutEverywhere";
import { listSessions, type SessionRow } from "@/app/actions/settings/listSessions";

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SecurityClient({ mfaEnrolled }: { mfaEnrolled: boolean }) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSigningOut, startSignOut] = useTransition();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    void listSessions().then((r) => setSessions(r.ok ? r.sessions : []));
  }, []);

  function handleRegenerate() {
    if (
      !confirm(
        "Gerar novos códigos invalida TODOS os atuais. Tem certeza?",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await regenerateRecoveryCodes();
      if (r.ok) {
        setCodes(r.recovery_codes);
        toast.success("Novos códigos gerados.");
      } else {
        toast.error(`Erro: ${r.error}`);
      }
    });
  }

  function handleSignOutAll() {
    if (!confirm("Sair de TODOS os dispositivos? Você precisará fazer login de novo.")) return;
    startSignOut(async () => {
      await signOutEverywhere();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="space-y-3 p-6">
        <h2 className="text-sm font-semibold">Códigos de recuperação</h2>
        <p className="text-xs text-muted-foreground">
          Use se perder acesso ao autenticador. Cada código é de uso único.
        </p>
        {codes ? (
          <RecoveryCodesPanel codes={codes} onAcknowledge={() => setCodes(null)} />
        ) : (
          <Button
            variant="outline"
            disabled={!mfaEnrolled || isPending}
            onClick={handleRegenerate}
          >
            {isPending ? "Gerando…" : "Regenerar códigos de recuperação"}
          </Button>
        )}
        {!mfaEnrolled && (
          <p className="text-xs text-muted-foreground">
            Habilite MFA antes de gerar códigos.
          </p>
        )}
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-sm font-semibold">Sessões ativas</h2>
        <p className="text-xs text-muted-foreground">
          Dispositivos onde sua conta está logada agora.
        </p>

        {sessions === null ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma sessão encontrada.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{s.userAgent ?? "Dispositivo desconhecido"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {s.ip ?? "IP oculto"} · ativo em {relativeDate(s.updatedAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Para encerrar tudo (inclusive esta sessão), deslogue todos os dispositivos:
        </p>
        <Button
          variant="outline"
          disabled={isSigningOut}
          onClick={handleSignOutAll}
        >
          {isSigningOut ? "Saindo…" : "Sair de todos os dispositivos"}
        </Button>
      </Card>
    </div>
  );
}
