"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProSignups, type ProSignupStatus } from "@/hooks/useProSignups";
import { formatBRL } from "@/lib/pricing/pro-plans";

const TABS: ReadonlyArray<{ value: ProSignupStatus | "all"; label: string }> = [
  { value: "pending", label: "Pendentes" },
  { value: "approved", label: "Aprovados" },
  { value: "rejected", label: "Rejeitados" },
  { value: "all", label: "Todos" },
];

const STATUS_VARIANT: Record<ProSignupStatus, "default" | "secondary" | "destructive" | "outline"> =
  {
    pending: "default",
    approved: "secondary",
    rejected: "destructive",
    cancelled: "outline",
  };

const STATUS_LABEL: Record<ProSignupStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
};

export function ProSignupsClient() {
  const [tab, setTab] = useState<ProSignupStatus | "all">("pending");
  const { data, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useProSignups(tab === "all" ? undefined : tab);

  const rows = data?.pages.flatMap((p) => p.data ?? []) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calc3D PRO</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos de liberação vindos da página pública. Confira o Pix antes de aprovar.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={tab === t.value ? "default" : "outline"}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        // Mostrar o erro, e não uma lista vazia: lista vazia por falha de leitura
        // é indistinguível de "não há pedidos", e foi exatamente esse modo de
        // falha silenciosa que o runbook de sessão do browser documenta.
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Falha ao carregar os pedidos: {error instanceof Error ? error.message : "erro desconhecido"}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum pedido {tab === "all" ? "registrado" : STATUS_LABEL[tab].toLowerCase()} por aqui.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Comprador</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Pagamento declarado</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="block font-medium text-foreground">{r.buyer_name}</span>
                    <span className="block text-xs text-muted-foreground">{r.buyer_email}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatBRL(r.amount_cents)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.declared_paid_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/pro-signups/${r.id}`}>Abrir</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasNextPage ? (
        <Button
          variant="outline"
          size="sm"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? "Carregando…" : "Carregar mais"}
        </Button>
      ) : null}
    </div>
  );
}
