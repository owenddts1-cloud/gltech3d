"use client";

/**
 * Documentos já emitidos desta O.S.
 *
 * Reimprimir abre o snapshot congelado — não o rascunho atual. Cancelar não
 * apaga: marca `voided_at` e a reimpressão passa a sair com tarja "CANCELADO",
 * porque um recibo entregue ao cliente não pode simplesmente sumir do histórico.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Printer, Trash } from "@/lib/ui/icons";
import { brlFromCents } from "@/lib/format/money";
import { DOC_TYPE_SHORT } from "@/lib/schemas/service-order-documents";
import {
  voidServiceOrderDocument,
  type DocumentListEntry,
} from "@/app/actions/service-orders/documents";

interface Props {
  documents: DocumentListEntry[];
  onVoided: (id: string) => void;
}

function formatIssued(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function DocumentHistory({ documents, onVoided }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-muted">
        Nenhum documento emitido para esta O.S. ainda.
      </p>
    );
  }

  function cancel(id: string) {
    const reason = window.prompt("Motivo do cancelamento:");
    if (!reason || reason.trim().length < 3) {
      setConfirming(null);
      return;
    }
    startTransition(async () => {
      const res = await voidServiceOrderDocument({ id, reason: reason.trim() });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Documento cancelado");
      onVoided(id);
      setConfirming(null);
    });
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              {doc.number}
              <span className="ml-2 font-normal text-text-muted">{DOC_TYPE_SHORT[doc.docType]}</span>
              {doc.voidedAt ? (
                <span className="ml-2 rounded bg-error-bg px-1.5 py-0.5 text-[10px] font-bold text-error-fg">
                  CANCELADO
                </span>
              ) : null}
            </p>
            <p className="text-[11px] text-text-muted">
              {formatIssued(doc.issuedAt)} · {brlFromCents(doc.totalCents)}
              {doc.voidReason ? ` · ${doc.voidReason}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg text-[11px]"
              onClick={() => window.open(`/documentos/${doc.id}`, "_blank", "noopener")}
            >
              <Printer size={13} className="mr-1" /> Reimprimir
            </Button>
            {!doc.voidedAt ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Cancelar documento ${doc.number}`}
                className="h-8 rounded-lg px-2 text-error"
                disabled={pending && confirming === doc.id}
                onClick={() => {
                  setConfirming(doc.id);
                  cancel(doc.id);
                }}
              >
                <Trash size={13} />
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
