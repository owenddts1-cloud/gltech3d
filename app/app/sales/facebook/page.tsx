import { fetchSales } from "@/app/actions/sales/actions";
import SalesClient from "../_components/SalesClient";

export const metadata = { title: "Facebook" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const r = await fetchSales("Facebook");
  return (
    <SalesClient
      platform="Facebook"
      title="Facebook"
      subtitle="Vendas pelo Facebook Marketplace."
      initialSales={r.ok ? r.sales : []}
      byPlatform={[]}
      productOptions={r.ok ? r.productOptions : []}
      contactOptions={r.ok ? r.contactOptions : []}
    />
  );
}
