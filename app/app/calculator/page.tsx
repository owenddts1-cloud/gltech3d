import { Calculadora3DClient } from "./_components/Calculadora3DClient";
import { fetchCalculatorData } from "@/app/actions/calculator/actions";

export const metadata = { title: "Calculadora 3D — GLTECH CRM" };
export const dynamic = "force-dynamic";

export default async function CalculatorPage() {
  const data = await fetchCalculatorData();
  const initial = data.ok
    ? { printers: data.printers, filaments: data.filaments, contacts: data.contacts, orgId: data.orgId }
    : { printers: [], filaments: [], contacts: [], orgId: null };

  return <Calculadora3DClient initialData={initial} />;
}
