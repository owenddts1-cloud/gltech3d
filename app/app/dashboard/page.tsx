import { fetchPrintersAndFilaments } from "@/app/actions/printers/actions";
import { DashboardClient } from "./_components/DashboardClient";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const result = await fetchPrintersAndFilaments();
  
  // Cast from unknown[] (server action boundary) to the client-expected types.
  // The server action returns JSON-serializable data that matches these shapes.
  const initialData = result.ok && result.printers ? {
    printers: result.printers as Array<{
      id: string; name: string; status: "idle" | "printing" | "error" | "offline";
      powerDraw: number; depreciationPerHour: number; activeFilamentId?: string | null;
      activePrintJob?: { filename: string; progress: number; timeElapsed: number; timeRemaining: number; filamentId: string; weightGrams: number; } | null;
    }>,
    filaments: result.filaments as Array<{
      id: string; name: string; color: string; material: string; weightGrams: number;
      initialWeightGrams: number; costPerGram: number; minWeightAlert: number; supplier: string;
    }>,
    printJobs: result.printJobs as Array<{
      id: string; printerId: string; printerName: string; filename: string; weightGrams: number;
      printTimeSeconds: number; filamentId: string | null; filamentName: string;
      costs: { materialCost: number; energyCost: number; depreciationCost: number; totalCost: number; } | null;
      completedAt: string;
    }>,
    kEnergy: result.kEnergy,
    orgId: result.orgId
  } : {
    printers: [],
    filaments: [],
    printJobs: [],
    kEnergy: 0.85,
    orgId: null
  };

  return <DashboardClient initialData={initialData} />;
}
