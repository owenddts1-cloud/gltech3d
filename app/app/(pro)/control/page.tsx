import { fetchFinancialRecords } from "@/app/actions/control/actions";
import { ControlClient } from "./_components/ControlClient";

export const metadata = { title: "Controle Financeiro" };
export const dynamic = "force-dynamic";

export default async function ControlPage() {
  const r = await fetchFinancialRecords();
  const records = r.ok ? r.data : [];
  return <ControlClient initialRecords={records} />;
}
