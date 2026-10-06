"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PlanStatusBadge,
  REQUEST_STATUS_LABEL,
  formatDay,
  planExpiryText,
} from "@/components/admin/subscribers/plan-display";
import { useSubscribers, type SubscriberFilter } from "@/hooks/useSubscribers";

const FILTERS: ReadonlyArray<{ value: SubscriberFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pro", label: "PRO ativo" },
  { value: "trial", label: "Em trial" },
  { value: "expired", label: "Vencido" },
  { value: "free", label: "Gratuito" },
];

const EMPTY_LABEL: Record<SubscriberFilter, string> = {
  all: "Nenhum assinante ou trial ainda.",
  pro: "Nenhum PRO ativo.",
  trial: "Ninguém em trial agora.",
  expired: "Nenhum plano vencido.",
  free: "Nenhuma organização no plano gratuito.",
};

export function SubscribersClient() {
  const [filter, setFilter] = useState<SubscriberFilter>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce: cada tecla não pode virar uma consulta cross-tenant + auditoria.
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSubscribers(filter, debounced);
  const rows = data?.pages.flatMap((p) => p.data ?? []) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assinantes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plano, vencimento e equipe de cada cliente. Toda alteração pede um motivo e fica na
          auditoria.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por situação">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              role="tab"
              aria-selected={filter === f.value}
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou slug"
          className="sm:max-w-xs"
          aria-label="Buscar assinante"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : isError ? (
        // Erro explícito, nunca lista vazia: vazio por falha de leitura é
        // indistinguível de "não há assinantes".
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Falha ao carregar os assinantes: {error instanceof Error ? error.message : "erro desconhecido"}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {debounced.trim() ? "Nada encontrado para esta busca." : EMPTY_LABEL[filter]}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Organização</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 font-medium">Membros</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Último pedido</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="block font-medium text-foreground">{r.display_name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{r.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    <PlanStatusBadge state={r.state} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{planExpiryText(r.state)}</td>
                  <td className="px-4 py-3 tabular-nums">{r.members_count}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.owner?.email ?? (r.owner ? "e-mail indisponível" : "sem admin")}
                  </td>
                  <td className="px-4 py-3">
                    {r.last_request ? (
                      <span className="flex items-center gap-2">
                        <Badge variant={r.last_request.status === "pending" ? "default" : "neutral"}>
                          {REQUEST_STATUS_LABEL[r.last_request.status] ?? r.last_request.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDay(r.last_request.created_at)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/assinantes/${r.id}`}>Abrir</Link>
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
