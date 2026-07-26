"use client";

/**
 * Foto de um item do documento.
 *
 * Reusa a MESMA infraestrutura de mídia do Landing Edit e de Produtos (bucket
 * `landing-media`, migration 0042): o Server Action só emite a URL assinada e o
 * browser sobe o arquivo direto no Storage — arquivo não passa pelo action, que
 * tem limite de body de 1 MB e reprovaria qualquer foto de peça.
 */

import { useRef, useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/browser";
import { createMediaUploadUrl } from "@/app/actions/landing/media";
import { LANDING_MEDIA_ACCEPT, LANDING_MEDIA_BUCKET } from "@/lib/landing/media-config";
import { CircleNotch, ImageIcon, Scissors, Trash, UploadSimple } from "@/lib/ui/icons";
import { removeBackgroundAuto } from "@/lib/utils/background-removal";

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
}

export function ItemPhotoField({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const signed = await createMediaUploadUrl({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (!signed.ok) {
        toast.error(signed.error);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(LANDING_MEDIA_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (error) {
        toast.error(error.message);
        return;
      }
      onChange(signed.publicUrl);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemoveBg() {
    if (!value) return;
    setRemovingBg(true);
    toast.info("Removendo fundo da imagem com IA...");
    try {
      const resultUrl = await removeBackgroundAuto(value);
      onChange(resultUrl);
      toast.success("Fundo removido com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível remover o fundo.");
    } finally {
      setRemovingBg(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-border bg-surface-elevated">
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Remover foto do item"
              className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white"
            >
              <Trash size={10} />
            </button>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-subtle">
            <ImageIcon size={18} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 text-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || removingBg}
          className="flex items-center justify-center gap-1 text-[10px] text-text-muted transition-colors hover:text-accent disabled:opacity-50"
        >
          {uploading ? <CircleNotch size={10} className="animate-spin" /> : <UploadSimple size={10} />}
          {uploading ? "Enviando…" : value ? "Trocar" : "Enviar"}
        </button>

        {value ? (
          <button
            type="button"
            onClick={() => void handleRemoveBg()}
            disabled={removingBg || uploading}
            className="flex items-center justify-center gap-0.5 text-[9px] font-medium text-amber-500 hover:text-amber-400 disabled:opacity-50"
            title="Recortar fundo da foto automaticamente com IA"
          >
            {removingBg ? <CircleNotch size={9} className="animate-spin" /> : <Scissors size={9} />}
            {removingBg ? "Recortando…" : "Cortar Fundo"}
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={LANDING_MEDIA_ACCEPT}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
