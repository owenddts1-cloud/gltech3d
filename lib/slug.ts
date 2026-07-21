/** Slug auto-gerado: "Action Figure" → "action-figure" */
export function autoSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/g, "-")
    .replace(/^-|-$/g, "");
}
