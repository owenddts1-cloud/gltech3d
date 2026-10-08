import type { Metadata } from "next";
import { fetchCalculatorData } from "@/app/actions/calculator/actions";
import { CalculatorWizardClient } from "./_components/CalculatorWizardClient";

export const metadata: Metadata = {
  title: "Calc3D PRO — Precificação e Fatiamento 3D",
  description: "Wizard avançado de precificação, raio-x de arquivos 3D e viabilidade de lote.",
};

export const dynamic = "force-dynamic";

export default async function CalculatorPage() {
  const data = await fetchCalculatorData();

  const filaments = data.ok ? data.filaments : [];
  const printers = data.ok ? data.printers : [];
  const contacts = data.ok ? data.contacts : [];
  const orgId = data.ok ? data.orgId : "";

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
        initialFilaments={filaments}
        initialPrinters={printers}
        initialContacts={contacts}
        orgId={orgId}
      />
    </div>
  );
}
