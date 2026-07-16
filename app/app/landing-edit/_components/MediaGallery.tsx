'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/browser';
import { Upload, Trash2, Star, X, ImageIcon, Film, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createMediaUploadUrl, deleteMedia, listMedia } from '@/app/actions/landing/media';
import {
  LANDING_MEDIA_ACCEPT,
  LANDING_MEDIA_BUCKET,
  type MediaAsset,
} from '@/lib/landing/media-config';

/**
 * Biblioteca de mídia: mostra o que já está guardado, aceita upload novo e
 * exclusão, e liga arquivos à peça selecionada.
 *
 * O upload vai direto do browser para o Storage com uma URL assinada emitida
 * pelo servidor — arquivo não passa pelo Server Action (limite de 1 MB de body).
 */

const humanSize = (bytes: number): string =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

interface Props {
  /** Imagens da peça, em ordem. A primeira é a capa. */
  images: string[];
  videos: string[];
  onChangeImages: (next: string[]) => void;
  onChangeVideos: (next: string[]) => void;
}

export default function MediaGallery({ images, videos, onChangeImages, onChangeVideos }: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const r = await listMedia();
    if (!r.ok) {
      toast.error(r.error);
      setLoading(false);
      return;
    }
    setAssets(r.assets);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const supabase = createClient();

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

      // Já anexa na peça aberta: subir foto e ter de clicar de novo para usar
      // seria um passo a mais sem motivo.
      if (file.type.startsWith('video/')) onChangeVideos([...videos, signed.publicUrl]);
      else onChangeImages([...images, signed.publicUrl]);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    void refresh();
  }

  async function handleDelete(asset: MediaAsset) {
    const usedHere = images.includes(asset.url) || videos.includes(asset.url);
    const msg = usedHere
      ? `"${asset.name}" está em uso nesta peça. Excluir do armazenamento e remover daqui?`
      : `Excluir "${asset.name}" do armazenamento? Isso não tem desfazer.`;
    if (!window.confirm(msg)) return;

    const r = await deleteMedia(asset.path);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    if (usedHere) {
      onChangeImages(images.filter((u) => u !== asset.url));
      onChangeVideos(videos.filter((u) => u !== asset.url));
    }
    setAssets((prev) => prev.filter((a) => a.path !== asset.path));
    toast.success('Arquivo excluído');
  }

  function toggleAttach(asset: MediaAsset) {
    const list = asset.kind === 'video' ? videos : images;
    const setList = asset.kind === 'video' ? onChangeVideos : onChangeImages;
    setList(list.includes(asset.url) ? list.filter((u) => u !== asset.url) : [...list, asset.url]);
  }

  return (
    <div className="space-y-4">
      {/* Mídia da peça, na ordem em que aparece na vitrine */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nesta peça ({images.length + videos.length})
          </h4>
          {images.length > 0 && (
            <span className="text-[10px] text-muted-foreground">1ª imagem = capa do card</span>
          )}
        </div>

        {images.length === 0 && videos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
            Sem mídia. A landing mostra o placeholder &quot;Foto em produção&quot;.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {images.map((url, i) => (
              <div
                key={url}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-accent px-1 py-0.5 text-[9px] font-bold text-accent-foreground">
                    <Star className="h-2 w-2 fill-current" />
                    Capa
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {i > 0 && (
                    <button
                      type="button"
                      title="Tornar capa"
                      onClick={() => onChangeImages([url, ...images.filter((u) => u !== url)])}
                      className="rounded p-1 text-white hover:bg-white/20"
                    >
                      <Star className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Remover desta peça"
                    onClick={() => onChangeImages(images.filter((u) => u !== url))}
                    className="rounded p-1 text-white hover:bg-white/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {videos.map((url) => (
              <div
                key={url}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
              >
                <video src={url} className="h-full w-full object-cover" muted playsInline />
                <span className="absolute left-1 top-1 rounded bg-black/60 p-0.5 text-white">
                  <Film className="h-2.5 w-2.5" />
                </span>
                <button
                  type="button"
                  title="Remover desta peça"
                  onClick={() => onChangeVideos(videos.filter((u) => u !== url))}
                  className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="mx-auto h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tudo que já está no armazenamento */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Biblioteca ({assets.length})
          </h4>
          <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1 h-3.5 w-3.5" />
            )}
            {uploading ? 'Enviando…' : 'Enviar arquivo'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={LANDING_MEDIA_ACCEPT}
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>

        {loading ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">Carregando…</p>
        ) : assets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
            Nada guardado ainda. As fotos antigas vivem em /public e não aparecem aqui.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {assets.map((asset) => {
              const attached = images.includes(asset.url) || videos.includes(asset.url);
              return (
                <div
                  key={asset.path}
                  className={`group relative aspect-square overflow-hidden rounded-lg border bg-muted transition-colors ${
                    attached ? 'border-accent ring-1 ring-accent' : 'border-border'
                  }`}
                >
                  {asset.kind === 'video' ? (
                    <video src={asset.url} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                  )}

                  <div className="absolute inset-0 flex flex-col justify-between bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        title="Excluir do armazenamento"
                        onClick={() => void handleDelete(asset)}
                        className="rounded p-1 text-white hover:bg-error/80"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAttach(asset)}
                      className="rounded bg-white/90 px-1 py-0.5 text-[9px] font-bold text-black hover:bg-white"
                    >
                      {attached ? 'Remover' : 'Usar'}
                    </button>
                  </div>

                  <span className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1 py-0.5 text-[8px] text-white group-hover:opacity-0">
                    {humanSize(asset.sizeBytes)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[10px] leading-snug text-muted-foreground">
        <ImageIcon className="mt-0.5 h-3 w-3 shrink-0" />
        Imagem até 50 MB (PNG, JPG, WebP, AVIF, GIF) ou vídeo (MP4, WebM). O arquivo vai direto do
        seu navegador para o armazenamento.
      </p>
    </div>
  );
}
