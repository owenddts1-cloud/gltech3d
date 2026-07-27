"use client";

import { createClient } from "@/lib/supabase/browser";
import { createMediaUploadUrl } from "@/app/actions/landing/media";
import { LANDING_MEDIA_BUCKET } from "@/lib/landing/media-config";

/**
 * Sobe uma imagem para o bucket `landing-media` e devolve a URL pública.
 *
 * O arquivo NÃO passa pelo Server Action: ele emite uma URL assinada e o browser
 * envia direto para o Storage (o limite de body de 1 MB do Next reprovaria
 * qualquer foto de peça). Mesmo caminho já usado por Produtos e Landing Edit.
 *
 * Existe como helper compartilhado porque o recorte de fundo gera um `Blob` que
 * PRECISA ser persistido: usar `URL.createObjectURL` no lugar disso grava um
 * `blob:` de sessão no snapshot imutável do documento, e a imagem quebra no
 * primeiro reload — sem conserto, já que o snapshot não pode ser reescrito.
 *
 * Lança em qualquer falha; quem chama decide como avisar.
 */
export async function uploadImageBlob(blob: Blob, filename: string): Promise<string> {
  const signed = await createMediaUploadUrl({
    filename,
    contentType: blob.type,
    sizeBytes: blob.size,
  });
  if (!signed.ok) throw new Error(signed.error);

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(LANDING_MEDIA_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, blob);
  if (error) throw new Error(error.message);

  return signed.publicUrl;
}
