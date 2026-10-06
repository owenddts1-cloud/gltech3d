"use client";

/**
 * Amber dismissible banner: unpaid sales older than 7 days. "Ver pendentes"
 * applies the pending-payment filter in the parent shell.
 */

import { Warning, X } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { brl } from "../_lib/view-model";

interface Props {
  count: number;
  sumCents: number;
  onShowPending: () => void;
  onDismiss: () => void;
}

export default function PendingAlert({ count, sumCents, onShowPending, onDismiss }: Props) {
  if (count === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning-bg px-4 py-3"
    >
      <Warning className="h-4 w-4 shrink-0 text-warning-fg" weight="fill" />
      <p className="flex-1 text-sm text-warning-fg">
        <span className="font-semibold">
          {count} {count === 1 ? "venda pendente" : "vendas pendentes"} há +7 dias
        </span>{" "}
        — somam {brl(sumCents)}.
      </p>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onShowPending}
          className="text-warning-fg hover:bg-warning/15 hover:text-warning-fg"
        >
          Ver pendentes
        </Button>
        <button
          type="button"
          aria-label="Dispensar alerta"
          onClick={onDismiss}
          className="rounded p-1 text-warning-fg/70 hover:text-warning-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
