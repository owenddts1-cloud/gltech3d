import { fetchReportsData, type ReportsData } from "@/app/actions/reports/actions";
import { ReportsClient } from "./_components/ReportsClient";

export const metadata = { title: "Relatórios" };
export const dynamic = "force-dynamic";

const EMPTY: ReportsData = {
  monthly: [],
  osConcluidas: 0,
  osTotal: 0,
  sources: [],
  printers: [],
  insights: [{ id: "empty", tone: "info", title: "Sem dados ainda", text: "Conclua OS e rode a telemetria para ver os relatórios." }],
};

export default async function ReportsPage() {
  const r = await fetchReportsData();
  return <ReportsClient data={r.ok ? r.data : EMPTY} />;
}
