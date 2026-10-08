import { Metadata } from "next";
import { fetchCashflowSummaryAction } from "@/app/actions/financial/cashflow";
import { CashflowClient } from "./CashflowClient";

export const metadata: Metadata = {
  title: "Fluxo de Caixa & Conciliação Pix | GLTech3D",
  description: "Extrato de saldo realizado, projeção de liquidações e conciliação de chaves Pix",
};

export default async function CashflowPage() {
  const res = await fetchCashflowSummaryAction();
  const summary = res.ok && res.data
    ? res.data
    : {
        currentBalanceCents: 0,
        projectedInflowCents: 0,
        projectedOutflowCents: 0,
        projectedBalanceCents: 0,
        unreconciledPixCount: 0,
        recentTransactions: [],
      };

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6">
      <CashflowClient summary={summary} />
    </div>
  );
}
