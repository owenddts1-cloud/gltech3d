'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/browser';
import { Upload, Trash2, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createMediaUploadUrl, listMedia } from '@/app/actions/landing/media';
import { LANDING_MEDIA_BUCKET, type MediaAsset } from '@/lib/landing/media-config';

/**
 * Imagem de topo (banner) de uma seção.
 *
 * Sobe arquivo novo ou escolhe um que já está na biblioteca — o mesmo bucket das
 * fotos das peças, para não existirem dois lugares de mídia.
 *
 * Não apaga do armazenamento: aqui "Remover" só desliga o banner da seção. Quem
 * exclui arquivo é a biblioteca, na aba Peças — assim ninguém apaga sem querer
 * uma imagem que outra peça usa.
 */
export default function BannerPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (next: string) => void;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!picking || assets.length > 0) return;
    void (async () => {
      const r = await listMedia();
      if (r.ok) setAssets(r.assets.filter((a) => a.kind === 'image'));
    })();
  }, [picking, assets.length]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const signed = await createMediaUploadUrl({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
    if (!signed.ok) {
      toast.error(signed.error);
      setUploading(false);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(LANDING_MEDIA_BUCKET)
      .uploadToSignedUrl(signed.path, signed.token, file);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    if (error) {
      toast.error(error.message);
      return;
    }
    onChange(signed.publicUrl);
    setAssets([]);
    toast.success('Banner atualizado');
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="group relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Banner do topo" className="h-28 w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
              Trocar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPicking((v) => !v)}>
              Biblioteca
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onChange('')}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex-1"
          >
            {uploading ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1 h-3.5 w-3.5" />
            )}
            {uploading ? 'Enviando…' : 'Enviar imagem'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPicking((v) => !v)} className="flex-1">
            <ImageIcon className="mr-1 h-3.5 w-3.5" />
            Da biblioteca
          </Button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {picking && (
        <div className="rounded-lg border border-border p-2">
          {assets.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-muted-foreground">
              Nenhuma imagem na biblioteca ainda.
            </p>
          ) : (
            <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto">
              {assets.map((a) => (
                <button
                  key={a.path}
                  type="button"
                  onClick={() => {
                    onChange(a.url);
                    setPicking(false);
                  }}
                  className="aspect-video overflow-hidden rounded border border-border transition-colors hover:border-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!value && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Sem banner, o topo usa o vídeo padrão do site.
        </p>
      )}
    </div>
  );
}
