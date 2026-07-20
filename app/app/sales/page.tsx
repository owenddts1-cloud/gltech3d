import { fetchSales } from "@/app/actions/sales/actions";
import SalesClient from "./_components/SalesClient";

export const metadata = { title: "Vendas" };
export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const r = await fetchSales();
  return (
    <SalesClient
      title="Vendas"
      subtitle="Todos os canais num só painel. Lance pedidos manualmente por enquanto."
      initialSales={r.ok ? r.sales : []}
      byPlatform={r.ok ? r.byPlatform : []}
      productOptions={r.ok ? r.productOptions : []}
    />
  );
}
