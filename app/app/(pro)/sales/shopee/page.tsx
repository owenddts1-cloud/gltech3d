import { fetchSales } from "@/app/actions/sales/actions";
import { fetchChannelIntegration } from "@/app/actions/sales/channels";
import { SalesChannelView } from "../_components/SalesChannelView";

export const metadata = { title: "Shopee" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [salesRes, channelRes] = await Promise.all([
    fetchSales("Shopee"),
    fetchChannelIntegration("Shopee"),
  ]);

  const defaultIntegration = {
    id: "",
    platform: "Shopee" as const,
    is_enabled: false,
    credentials: {},
    webhook_secret: "whsec_default",
  };

  return (
    <SalesChannelView
      platform="Shopee"
      title="Shopee"
      subtitle="Pedidos, sincronização e faturamento da sua loja na Shopee."
      initialSales={salesRes.ok ? salesRes.sales : []}
      productOptions={salesRes.ok ? salesRes.productOptions : []}
      contactOptions={salesRes.ok ? salesRes.contactOptions : []}
      channelOptions={salesRes.ok ? salesRes.channelOptions : []}
      integration={channelRes.ok && channelRes.integration ? channelRes.integration : defaultIntegration}
    />
  );
}
