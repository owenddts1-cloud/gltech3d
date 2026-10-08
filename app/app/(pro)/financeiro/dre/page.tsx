import { Metadata } from "next";
import { fetchFinancialRecords } from "@/app/actions/control/actions";
import { DreClient } from "./DreClient";

export const metadata: Metadata = {
  title: "DRE Gerencial em Tempo Real | GLTech3D",
  description: "Demonstrativo de Resultado do Exercício com custos reais de filamento e farm 3D",
};

export default async function DrePage() {
  const res = await fetchFinancialRecords();
  const records = res.ok ? res.data : [];

  const transactions = records.map((r: any) => ({
    id: r.id,
    date: r.date,
    type: r.type,
    category: r.category,
    channel: r.channel || r.platform || "manual",
    revenue_cents: Math.round((r.revenue || 0) * 100),
    expense_cents: Math.round((r.expense || 0) * 100),
    platform_fee_cents: Math.round((r.platform_fee || 0) * 100),
    net_cents: Math.round((r.net_amount || 0) * 100),
    cpv_filament_cost_cents: Math.round((r.cpv_filament_cost_cents || 0)),
    cpv_machine_cost_cents: Math.round((r.cpv_machine_cost_cents || 0)),
    status: r.status,
  }));

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6">
      <DreClient initialTransactions={transactions} />
    </div>
  );
}
