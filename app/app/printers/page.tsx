import { fetchPrintersAndFilaments } from "@/app/actions/printers/actions";
import { fetchServiceOrdersData } from "@/app/actions/service-orders/actions";
import { DashboardClient } from "@/app/app/dashboard/_components/DashboardClient";

export const metadata = { title: "Impressoras & Filamentos" };
export const dynamic = "force-dynamic";

// A telemetria/CRUD de impressoras (feita pelo Antigravity) vive aqui, na aba
// Impressoras — o Dashboard virou a visão de negócio (KPIs + gráficos + feed).
export default async function PrintersPage() {
  const [result, soResult] = await Promise.all([
    fetchPrintersAndFilaments(),
    fetchServiceOrdersData(),
  ]);

  // OS ativas (não concluídas) para vincular à impressão.
  const serviceOrders =
    soResult.ok
      ? soResult.orders
          .filter((o) => o.status !== "concluido")
          .map((o) => ({
            id: o.id,
            title: o.title,
            contactName: o.contactName,
            status: o.status,
            priority: o.priority,
            material: o.material,
            totalCents: o.totalCents,
            slaDueAt: o.slaDueAt,
          }))
      : [];

  const initialData = result.ok && result.printers ? {
    printers: result.printers as Array<{
      id: string; name: string; status: "idle" | "printing" | "error" | "offline" | "maintenance";
      powerDraw: number; depreciationPerHour: number; activeFilamentId?: string | null;
      activePrintJob?: { filename: string; progress: number; timeElapsed: number; timeRemaining: number; filamentId: string; weightGrams: number; serviceOrderId?: string | null; serviceOrderTitle?: string | null } | null;
      networkUrl?: string; apiKey?: string; pollMode?: "browser" | "server" | "off";
    }>,
    filaments: result.filaments as Array<{
      id: string; name: string; color: string; material: string; weightGrams: number;
      initialWeightGrams: number; costPerGram: number; minWeightAlert: number; supplier: string;
    }>,
    printJobs: result.printJobs as Array<{
      id: string; printerId: string; printerName: string; filename: string; weightGrams: number;
      printTimeSeconds: number; filamentId: string | null; filamentName: string;
      costs: { materialCost: number; energyCost: number; depreciationCost: number; totalCost: number } | null;
      serviceOrderId: string | null; completedAt: string;
    }>,
    serviceOrders,
    kEnergy: result.kEnergy,
    orgId: result.orgId,
  } : {
    printers: [],
    filaments: [],
    printJobs: [],
    serviceOrders,
    kEnergy: 0.85,
    orgId: null,
  };

  return <DashboardClient initialData={initialData} />;
}
