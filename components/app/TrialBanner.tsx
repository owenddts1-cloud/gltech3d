"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Lock, Clock } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/auth/AuthProvider";

const DISMISS_KEY = "gltech3d-trial-banner-dismissed-at";
const DISMISS_HOURS = 24;

/**
 * Faixa de estado do trial no topo do CRM.
 *
 * Espelha `ImpersonateBanner`, que já ocupa esse lugar na árvore.
 *
 * Dispensável SÓ enquanto o trial corre. Expirado é informação que o usuário
 * precisa para entender por que metade do menu está com cadeado — esconder isso
 * produz "o sistema quebrou" em vez de "preciso assinar".
 *
 * O adiamento usa `localStorage` com carimbo de hora, não `sessionStorage`:
 * voltar a faixa toda vez que a aba é reaberta irrita sem converter.
 */
export function TrialBanner() {
  const plan = usePlan();
  const [dismissed, setDismissed] = useState(true);

  // Lido depois da montagem: ler storage durante o render faria o HTML do
  // servidor discordar da primeira pintura do cliente.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      const at = raw ? Number(raw) : 0;
      setDismissed(Number.isFinite(at) && Date.now() - at < DISMISS_HOURS * 3_600_000);
    } catch {
      // Storage bloqueado (janela privada, cookies negados): mostra a faixa.
      setDismissed(false);
    }
  }, []);

  if (!plan) return null;
  if (plan.status === "active" || plan.status === "none") return null;

  const expired = plan.status === "trial_expired" || plan.status === "expired";
  if (!expired && dismissed) return null;

  const dias = plan.trialDaysLeft ?? 0;
  const urgente = !expired && dias <= 3;

  function dispensar() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Sem storage não dá para lembrar da escolha; some só nesta renderização.
    }
    setDismissed(true);
  }

  return (
    <div
      data-no-print
      className={cn(
        "flex items-center gap-3 border-b px-4 py-2 text-sm",
        expired
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : urgente
            ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400"
            : "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      {expired ? (
        <Lock size={16} weight="fill" aria-hidden className="shrink-0" />
      ) : (
        <Clock size={16} aria-hidden className="shrink-0" />
      )}

      <p className="min-w-0 flex-1">
        {expired ? (
          <>
            <strong>Seu acesso PRO pausou.</strong> Seus dados estão guardados — os módulos
            destravam assim que o pagamento for confirmado.
          </>
        ) : (
          <>
            <strong>
              Trial do Calc3D PRO: {dias} {dias === 1 ? "dia restante" : "dias restantes"}.
            </strong>{" "}
            Depois disso os módulos PRO pausam e nada é apagado.
          </>
        )}
      </p>

      <Link
        href="/app/settings/billing"
        className="shrink-0 rounded-md border border-current px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
      >
        {expired ? "Destravar" : "Ver planos"}
      </Link>

      {!expired && (
        <button
          type="button"
          onClick={dispensar}
          aria-label="Dispensar aviso por 24 horas"
          className="shrink-0 rounded p-1 transition-opacity hover:opacity-70"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
