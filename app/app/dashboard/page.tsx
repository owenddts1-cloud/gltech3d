import { fetchDashboardOverview, type DashboardOverview as TOverview } from "@/app/actions/dashboard/overview";
import { DashboardOverview } from "./_components/DashboardOverview";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const EMPTY: TOverview = {
  kpis: { faturamentoMesCents: 0, faturamentoPrevCents: 0, osAtivas: 0, filamentoMesGramas: 0, lowStock: 0, clientes: 0, lucroEstimadoCents: 0 },
  osByStatus: { orcamento: 0, aprovado: 0, em_producao: 0, concluido: 0 },
  revenueSeries: [],
  spending: { filament: 0, energy: 0, depreciation: 0 },
  feed: [],
  activeOrders: [],
  performance: { successRate: 0, goals: [] },
};

export default async function DashboardPage() {
  const r = await fetchDashboardOverview();
  return <DashboardOverview data={r.ok ? r.data : EMPTY} />;
}
