import { fetchProductsData } from "@/app/actions/products/actions";
import { ProductsClient } from "./_components/ProductsClient";

export const metadata = { title: "Produtos" };
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const r = await fetchProductsData();
  return (
    <ProductsClient
      initialProducts={r.ok ? r.products : []}
      filaments={r.ok ? r.filaments : []}
      printers={r.ok ? r.printers : []}
    />
  );
}
