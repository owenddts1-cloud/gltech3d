import { fetchSales } from "@/app/actions/sales/actions";
import { getShopeeIntegrationStatus } from "@/app/actions/sales/shopee-status";
import SalesClient from "../_components/SalesClient";
import { ShopeeStatusCard } from "../_components/ShopeeStatusCard";

export const metadata = { title: "Shopee" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [r, status] = await Promise.all([fetchSales("Shopee"), getShopeeIntegrationStatus()]);
  return (
    <SalesClient
      platform="Shopee"
      title="Shopee"
      subtitle="Pedidos e faturamento da sua loja na Shopee."
      initialSales={r.ok ? r.sales : []}
      byPlatform={[]}
      productOptions={r.ok ? r.productOptions : []}
      contactOptions={r.ok ? r.contactOptions : []}
      banner={<ShopeeStatusCard configured={status.ok && status.configured} />}
    />
  );
}
