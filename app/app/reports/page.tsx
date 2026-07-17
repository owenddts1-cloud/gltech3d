import { fetchReportsData, type ReportsData } from "@/app/actions/reports/actions";
import { fetchReportBreakdowns, type ReportBreakdowns } from "@/app/actions/reports/breakdowns";
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

const emptyBreakdown = (key: ReportBreakdowns[keyof ReportBreakdowns]["key"], title: string): ReportBreakdowns[keyof ReportBreakdowns] =>
  ({ key, title, source: "", isCurrency: true, groups: [], drill: {} });

const EMPTY_BREAKDOWNS: ReportBreakdowns = {
  client: emptyBreakdown("client", "Receita por cliente"),
  category: emptyBreakdown("category", "Despesa por categoria"),
  project: emptyBreakdown("project", "Custo por projeto"),
  platform: emptyBreakdown("platform", "Receita por canal"),
};

export default async function ReportsPage() {
  const [r, b] = await Promise.all([fetchReportsData(), fetchReportBreakdowns()]);
  return <ReportsClient data={r.ok ? r.data : EMPTY} breakdowns={b.ok ? b.data : EMPTY_BREAKDOWNS} />;
}
