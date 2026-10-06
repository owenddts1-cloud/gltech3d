import { fetchProjectsData, type ProjectsData } from "@/app/actions/projects/actions";
import { ProjectsClient } from "./_components/ProjectsClient";

export const metadata = { title: "Projetos" };
export const dynamic = "force-dynamic";

const EMPTY: ProjectsData = { projects: [], notes: [] };

export default async function ProjectsPage() {
  const r = await fetchProjectsData();
  return <ProjectsClient data={r.ok ? r.data : EMPTY} />;
}
