import { fetchSales } from "@/app/actions/sales/actions";
import { fetchChannelIntegration } from "@/app/actions/sales/channels";
import { SalesChannelView } from "../_components/SalesChannelView";

export const metadata = { title: "Facebook" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [salesRes, channelRes] = await Promise.all([
    fetchSales("Facebook"),
    fetchChannelIntegration("Facebook"),
  ]);

  const defaultIntegration = {
    id: "",
    platform: "Facebook" as const,
    is_enabled: false,
    credentials: {},
    webhook_secret: "whsec_default",
  };

  return (
    <SalesChannelView
      platform="Facebook"
      title="Facebook"
      subtitle="Vendas e capturas automáticas pelo Facebook Marketplace."
      initialSales={salesRes.ok ? salesRes.sales : []}
      productOptions={salesRes.ok ? salesRes.productOptions : []}
      contactOptions={salesRes.ok ? salesRes.contactOptions : []}
      channelOptions={salesRes.ok ? salesRes.channelOptions : []}
      integration={channelRes.ok && channelRes.integration ? channelRes.integration : defaultIntegration}
    />
  );
}
