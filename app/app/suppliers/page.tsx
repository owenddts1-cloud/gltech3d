import { fetchPrintersAndFilaments } from "@/app/actions/printers/actions";
import { SuppliersClient } from "./_components/SuppliersClient";

export const metadata = { title: "Fornecedores" };
export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const result = await fetchPrintersAndFilaments();
  const filaments = result.ok && result.filaments ? result.filaments : [];

  // Map to correct properties expected by component
  const mappedFilaments = filaments.map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    material: f.material,
    weightGrams: f.weightGrams,
    initialWeightGrams: f.initialWeightGrams,
    costPerGram: f.costPerGram,
    minWeightAlert: f.minWeightAlert,
    supplier: f.supplier,
  }));

  return <SuppliersClient filaments={mappedFilaments} />;
}
