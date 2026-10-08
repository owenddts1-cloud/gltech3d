import { listSiteOrders } from "@/app/actions/site-orders/actions";
import { SiteOrdersClient } from "./_components/SiteOrdersClient";

export const metadata = { title: "Pedidos do site" };
export const dynamic = "force-dynamic";

export default async function SiteOrdersPage() {
  const r = await listSiteOrders();
  return <SiteOrdersClient initialOrders={r.ok ? r.orders : []} loadError={r.ok ? null : r.error} />;
}
