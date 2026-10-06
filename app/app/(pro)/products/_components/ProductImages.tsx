"use client";

/**
 * Fotos do produto — grade compacta + upload. Reusa a MESMA infraestrutura do
 * Landing Edit (bucket `landing-media`, migration 0042): `createMediaUploadUrl`
 * emite URL assinada, o browser sobe o arquivo direto no Storage (sem passar
 * pelo Server Action — limite de body de 1 MB). `products.images` é o MESMO
 * campo usado pela vitrine pública — não é um upload "separado" de Produtos,
 * é a mesma foto (DIRC: Integrar, não duplicar).
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";
import { Plus, Trash, CircleNotch } from "@/lib/ui/icons";
import { createMediaUploadUrl } from "@/app/actions/landing/media";
import { LANDING_MEDIA_ACCEPT, LANDING_MEDIA_BUCKET } from "@/lib/landing/media-config";

interface Props {
  images: string[];
  onChange: (next: string[]) => void;
}

export function ProductImages({ images, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const supabase = createClient();
    const next = [...images];

    for (const file of Array.from(files)) {
      const signed = await createMediaUploadUrl({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (!signed.ok) {
        toast.error(`${file.name}: ${signed.error}`);
        continue;
      }
      const { error } = await supabase.storage
        .from(LANDING_MEDIA_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (error) {
        toast.error(`${file.name}: ${error.message}`);
        continue;
      }
      next.push(signed.publicUrl);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    onChange(next);
  }

  function removeAt(idx: number) {
    onChange(images.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {images.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-elevated">
            {/* Fotos de produto, tamanho variável e fonte externa (Storage) — <img> é o certo aqui. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Remover foto"
              className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Trash size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
        >
          {uploading ? <CircleNotch size={18} className="animate-spin" /> : <Plus size={18} />}
          <span className="text-[10px]">{uploading ? "Enviando…" : "Adicionar"}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={LANDING_MEDIA_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {images.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Sem fotos ainda — as imagens aqui são as mesmas exibidas na landing pública.
        </p>
      )}
    </div>
  );
}
