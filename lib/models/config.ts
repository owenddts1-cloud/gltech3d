/**
 * Constantes do repositório de modelos 3D. Fora do módulo `"use server"` porque
 * lá só funções async podem ser exportadas (const/tipo derruba os exports).
 */
export const MODELS_BUCKET = "models-3d";
export const MODELS_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

/** Extensões aceitas no explorador. STL/3MF abrem em 3D; imagens no preview. */
export const MODELS_ACCEPT = ".stl,.3mf,.png,.jpg,.jpeg,.webp";

export type ModelKind = "stl" | "model3mf" | "image" | "other";

/** Deriva o tipo do arquivo pela extensão do nome. */
export function kindFromFilename(name: string): ModelKind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "stl") return "stl";
  if (ext === "3mf") return "model3mf";
  if (["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext)) return "image";
  return "other";
}

export interface FolderRow {
  id: string;
  parentId: string | null;
  name: string;
  icon: string;
  color: string | null;
  contactId: string | null;
  sortOrder: number | null;
}

export interface ModelBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface Model3dRow {
  id: string;
  name: string;
  filePath: string;
  sizeKb: number;
  triangles: number;
  volumeCm3: number;
  boundingBox: ModelBoundingBox;
  thumbnailUrl: string | null;
  createdAt: string;
  folderId: string | null;
  kind: ModelKind;
  mimeType: string | null;
}
