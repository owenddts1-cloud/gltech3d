import type { N8nTemplateItem } from "@/types/hub";
import rawTemplates from "./templates-data.json";

export const LOCAL_N8N_TEMPLATES: N8nTemplateItem[] = rawTemplates.map((t) => ({
  id: t.id,
  title: t.title,
  category: t.category,
  description: t.description,
  jsonContent: { name: t.title, filename: t.filename },
}));

export function getTemplatesFromPackage(): N8nTemplateItem[] {
  return LOCAL_N8N_TEMPLATES;
}

export function getCategories(): string[] {
  const set = new Set(LOCAL_N8N_TEMPLATES.map((t) => t.category));
  return Array.from(set).sort();
}
