import { fetchSales } from "@/app/actions/sales/actions";
import { fetchChannelIntegration } from "@/app/actions/sales/channels";
import { SalesChannelView } from "../_components/SalesChannelView";

export const metadata = { title: "Mercado Livre" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [salesRes, channelRes] = await Promise.all([
    fetchSales("Mercado Livre"),
    fetchChannelIntegration("Mercado Livre"),
  ]);

  const defaultIntegration = {
    id: "",
    platform: "Mercado Livre" as const,
    is_enabled: false,
    credentials: {},
    webhook_secret: "whsec_default",
  };

  return (
    <SalesChannelView
      platform="Mercado Livre"
      title="Mercado Livre"
      subtitle="Pedidos e faturamento automatizado no Mercado Livre."
      initialSales={salesRes.ok ? salesRes.sales : []}
      productOptions={salesRes.ok ? salesRes.productOptions : []}
      contactOptions={salesRes.ok ? salesRes.contactOptions : []}
      channelOptions={salesRes.ok ? salesRes.channelOptions : []}
      integration={channelRes.ok && channelRes.integration ? channelRes.integration : defaultIntegration}
    />
  );
}
