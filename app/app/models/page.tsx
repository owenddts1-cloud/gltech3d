import { fetchModels } from "@/app/actions/models/actions";
import { ModelsClient } from "./_components/ModelsClient";

export const metadata = { title: "Modelagem 3D" };
export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  const r = await fetchModels();
  // O erro precisa chegar à tela. Antes era `r.ok ? r.models : []`, e qualquer
  // falha de sessão, RLS ou org virava "Nenhum arquivo 3D enviado" — foi o que
  // fez um problema de leitura parecer perda de arquivo.
  return (
    <ModelsClient
      initialModels={r.ok ? r.models : []}
      loadError={r.ok ? null : r.error}
    />
  );
}
