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

/**
 * Nome de arquivo seguro: sem acento, sem espaço, sem path traversal.
 *
 * Mora aqui — e não em `media.ts` — porque tem dois consumidores: a Server
 * Action de upload e o importador em lote (`scripts/import-product-media.ts`).
 * Duas cópias produziriam caminhos diferentes para o mesmo arquivo, quebrando a
 * deduplicação do importador.
 */
export function safeName(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "arquivo";
  return (
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(-120) || "arquivo"
  );
}

/** Classifica pela extensão. `videos` e `images` são colunas distintas. */
export function mediaKindOf(name: string): "image" | "video" {
  return /\.(mp4|webm)$/i.test(name) ? "video" : "image";
}

/** Extensão → MIME aceito pelo bucket, ou `null` se o arquivo não serve. */
export function mimeFromExtension(name: string): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    avif: "image/avif",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return map[ext] ?? null;
}

/**
 * Ordena nomes de arquivo do jeito que uma pessoa espera: `foto2` antes de
 * `foto10`. A ordenação alfabética padrão erra isso, e como `images[0]` é a
 * CAPA da peça, errar aqui troca a foto principal.
 *
 * Nome começando com `capa` ou `00` vai para a frente da fila.
 */
export function compareMediaNames(a: string, b: string): number {
  const priority = (n: string): number => (/^(capa|00)/i.test(n) ? 0 : 1);
  const byPriority = priority(a) - priority(b);
  if (byPriority !== 0) return byPriority;
  return new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" }).compare(a, b);
}
