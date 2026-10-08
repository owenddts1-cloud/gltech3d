import { CalculatorWizardClient } from "./_components/CalculatorWizardClient";
import { fetchCalculatorData } from "@/app/actions/calculator/actions";

export const metadata = { title: "Calculadora 3D & Fatiador PRO — GLTECH CRM" };
export const dynamic = "force-dynamic";

export default async function CalculatorPage() {
  const data = await fetchCalculatorData();
  const initial = data.ok
    ? { printers: data.printers, filaments: data.filaments, contacts: data.contacts, orgId: data.orgId }
    : { printers: [], filaments: [], contacts: [], orgId: "" };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="font-sora text-2xl font-black text-[#241F1C]">
          Calculadora & Fatiador Calc3D
        </h1>
        <p className="mt-1 text-sm text-[#736B63]">
          Inspecione seus arquivos 3D, vincule com o estoque real de filamentos e simule a viabilidade econômica do lote.
        </p>
      </div>

      <CalculatorWizardClient
        initialFilaments={initial.filaments}
        initialPrinters={initial.printers}
        initialContacts={initial.contacts}
        orgId={initial.orgId || ""}
      />
    </div>
  );
}

