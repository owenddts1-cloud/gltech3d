import { fetchInventoryData, type InventoryData } from "@/app/actions/inventory/actions";
import { fetchConsumables, type ConsumablesData } from "@/app/actions/consumables/actions";
import { InventoryClient } from "./_components/InventoryClient";

export const metadata = { title: "Inventário" };
export const dynamic = "force-dynamic";

const EMPTY: InventoryData = {
  assets: [],
  kpis: { totalAssets: 0, patrimonyCents: 0, printers: 0, maintenance: 0 },
};
const EMPTY_CONSUMABLES: ConsumablesData = {
  items: [],
  kpis: { total: 0, lowStock: 0, stockValueCents: 0, totalKg: 0 },
};

export default async function InventoryPage() {
  const [inv, cons] = await Promise.all([fetchInventoryData(), fetchConsumables()]);
  return (
    <InventoryClient
      data={inv.ok ? inv.data : EMPTY}
      consumables={cons.ok ? cons.data : EMPTY_CONSUMABLES}
    />
  );
}
