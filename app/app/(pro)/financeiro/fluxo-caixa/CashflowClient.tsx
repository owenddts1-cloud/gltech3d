"use client";

import { useState } from "react";
import { type CashflowSummary, reconcilePixTransactionAction } from "@/app/actions/financial/cashflow";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  QrCode,
  Sparkles,
} from "lucide-react";

interface CashflowClientProps {
  summary: CashflowSummary;
}

export function CashflowClient({ summary: initialSummary }: CashflowClientProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const formatBRL = (cents: number) => {
    return (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const handleReconcile = async (txId: string) => {
    setLoadingId(txId);
    try {
      const res = await reconcilePixTransactionAction({
        transaction_id: txId,
        pix_e2e_id: `E_MANUAL_${Date.now()}`,
      });

      if (res.ok) {
        setSummary((prev) => {
          const updatedTransactions = prev.recentTransactions.map((tx) =>
            tx.id === txId ? { ...tx, status: "reconciled", is_projected: false } : tx
          );

          const targetTx = prev.recentTransactions.find((tx) => tx.id === txId);
          const amount = targetTx ? targetTx.revenue_cents : 0;

          return {
            ...prev,
            currentBalanceCents: prev.currentBalanceCents + amount,
            projectedInflowCents: Math.max(0, prev.projectedInflowCents - amount),
            unreconciledPixCount: Math.max(0, prev.unreconciledPixCount - 1),
            recentTransactions: updatedTransactions,
          };
        });
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border/40 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Wallet className="h-6 w-6 text-sky-500" />
          Fluxo de Caixa & Conciliação Pix
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhamento do saldo disponível, projeção de liquidações futuras e conciliação de chaves Pix
        </p>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Atual */}
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span>Saldo Atual (Realizado)</span>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatBRL(summary.currentBalanceCents)}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            Disponível em conta
          </p>
        </div>

        {/* Entradas Previstas */}
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span>Entradas Previstas</span>
            <ArrowUpRight className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-sky-500">
            {formatBRL(summary.projectedInflowCents)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {summary.unreconciledPixCount} Pix / pedidos aguardando
          </p>
        </div>

        {/* Saídas Previstas */}
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span>Saídas Previstas</span>
            <ArrowDownRight className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-500">
            {formatBRL(summary.projectedOutflowCents)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Contas a pagar / vencimentos
          </p>
        </div>

        {/* Saldo Projetado */}
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1">
            <span>Saldo Projetado</span>
            <Sparkles className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-500">
            {formatBRL(summary.projectedBalanceCents)}
          </div>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-1">
            Saldo final estimado
          </p>
        </div>
      </div>

      {/* Extrato e Conciliação */}
      <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              Extrato de Transações e Conciliação
            </h2>
            <p className="text-xs text-muted-foreground">
              Histórico recente e liquidação de chaves Pix em 1 clique
            </p>
          </div>
        </div>

        <div className="divide-y divide-border/30 text-sm">
          {summary.recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              Nenhuma transação registrada no período.
            </div>
          ) : (
            summary.recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 hover:bg-muted/10 gap-2"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      tx.type === "Receita"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-rose-500/10 text-rose-500"
                    }`}
                  >
                    {tx.payment_method === "pix" ? (
                      <QrCode className="h-4 w-4" />
                    ) : tx.type === "Receita" ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm flex items-center gap-2">
                      {tx.description}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">
                        {tx.category}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{tx.date}</span>
                      <span>•</span>
                      <span className="uppercase">{tx.payment_method}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:self-center self-end">
                  <div className="text-right">
                    <div
                      className={`font-semibold ${
                        tx.type === "Receita" ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {tx.type === "Receita" ? "+" : "-"}
                      {formatBRL(tx.type === "Receita" ? tx.revenue_cents : tx.expense_cents)}
                    </div>
                    <div className="text-[11px] flex items-center gap-1 justify-end">
                      {tx.status === "reconciled" ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Conciliado
                        </span>
                      ) : (
                        <span className="text-amber-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Pendente
                        </span>
                      )}
                    </div>
                  </div>

                  {tx.status === "pending" && (
                    <button
                      type="button"
                      disabled={loadingId === tx.id}
                      onClick={() => handleReconcile(tx.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                    >
                      {loadingId === tx.id ? "Conciliando..." : "Conciliar Pix"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
