import { fetchSuppliersData, type SuppliersData } from "@/app/actions/suppliers/actions";
import { SuppliersClient } from "./_components/SuppliersClient";

export const metadata = { title: "Fornecedores" };
export const dynamic = "force-dynamic";

const EMPTY: SuppliersData = { suppliers: [], purchases: [], filaments: [] };

export default async function SuppliersPage() {
  const r = await fetchSuppliersData();
  return <SuppliersClient data={r.ok ? r.data : EMPTY} />;
}
