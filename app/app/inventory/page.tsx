import { fetchInventoryData, type InventoryData } from "@/app/actions/inventory/actions";
import { InventoryClient } from "./_components/InventoryClient";

export const metadata = { title: "Inventário" };
export const dynamic = "force-dynamic";

const EMPTY: InventoryData = {
  assets: [],
  kpis: { totalAssets: 0, patrimonyCents: 0, printers: 0, maintenance: 0 },
};

export default async function InventoryPage() {
  const r = await fetchInventoryData();
  return <InventoryClient data={r.ok ? r.data : EMPTY} />;
}
