import { fetchModels } from "@/app/actions/models/actions";
import { ModelsClient } from "./_components/ModelsClient";

export const metadata = { title: "Modelagem 3D" };
export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  const r = await fetchModels();
  return <ModelsClient initialModels={r.ok ? r.models : []} />;
}
