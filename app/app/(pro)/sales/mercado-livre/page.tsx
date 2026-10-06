import { fetchSales } from "@/app/actions/sales/actions";
import SalesClient from "../_components/SalesClient";

export const metadata = { title: "Mercado Livre" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const r = await fetchSales("Mercado Livre");
  return (
    <SalesClient
      platform="Mercado Livre"
      title="Mercado Livre"
      subtitle="Pedidos e faturamento no Mercado Livre."
      initialSales={r.ok ? r.sales : []}
      byPlatform={[]}
      productOptions={r.ok ? r.productOptions : []}
      contactOptions={r.ok ? r.contactOptions : []}
      channelOptions={r.ok ? r.channelOptions : []}
    />
  );
}
