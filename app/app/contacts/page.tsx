import { createClient } from "@/lib/supabase/server";
import { ContactsListClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  // Pipeline default (para a aba "Funil"): prioriza is_default, senão o de menor position.
  const supabase = await createClient();
  const { data: pipelines } = await supabase
    .from("crm_pipelines")
    .select("id, is_default, position")
    .eq("is_archived", false)
    .order("is_default", { ascending: false })
    .order("position")
    .limit(1);

  const defaultPipelineId = pipelines?.[0]?.id ?? null;

  return <ContactsListClient defaultPipelineId={defaultPipelineId} />;
}
