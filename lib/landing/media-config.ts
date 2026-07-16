/**
 * Constantes e tipos da biblioteca de mídia.
 *
 * Vivem FORA de `app/actions/landing/media.ts` porque um módulo `"use server"`
 * só pode exportar funções async — exportar uma const ou um tipo de lá derruba
 * todos os exports do módulo (o build falha com "The module has no exports at
 * all"). O typecheck não pega isso; só o build.
 */

export const LANDING_MEDIA_BUCKET = "landing-media";

export const LANDING_MEDIA_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
  "video/mp4",
  "video/webm",
] as const;

/** 50 MB — mesmo teto declarado no bucket (migration 0042). */
export const LANDING_MEDIA_MAX_BYTES = 50 * 1024 * 1024;

export const LANDING_MEDIA_ACCEPT = LANDING_MEDIA_MIME.join(",");

export interface MediaAsset {
  /** Caminho dentro do bucket: `<orgId>/<uuid>-<nome>`. */
  path: string;
  name: string;
  url: string;
  sizeBytes: number;
  createdAt: string | null;
  kind: "image" | "video";
}
