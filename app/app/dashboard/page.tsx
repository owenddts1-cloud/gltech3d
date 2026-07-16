import { fetchDashboardData, type DashboardData } from "@/app/actions/dashboard/analytics";
import DashboardMain from "./_components/DashboardMain";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Estado vazio: org nova (ou migration não aplicada) abre a tela em branco com
 * os filtros funcionando, em vez de estourar.
 */
const EMPTY: DashboardData = {
  period: "mensal",
  kpis: {
    faturamentoCents: { value: 0, changePct: null },
    pedidosConcluidos: { value: 0, changePct: null },
    osAtivas: { value: 0, changePct: null },
    lucroLiquidoCents: { value: 0, changePct: null },
  },
  salesSeries: [],
  osSeries: [],
  salesRows: [],
  osRows: [],
  activities: [],
};

export default async function DashboardPage() {
  const r = await fetchDashboardData("mensal");
  return <DashboardMain initial={r.ok ? r.data : EMPTY} />;
}
