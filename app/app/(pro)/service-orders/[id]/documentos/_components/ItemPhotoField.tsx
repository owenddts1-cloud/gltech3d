"use client";

/**
 * Foto de um item do documento (e da imagem de destaque do cabeçalho).
 *
 * Reusa a mesma infraestrutura de mídia do Landing Edit e de Produtos (bucket
 * `landing-media`, migration 0042): o Server Action só emite a URL assinada e o
 * browser sobe o arquivo direto no Storage.
 *
 * O recorte de fundo abre uma prévia antes de aplicar, e o resultado é SEMPRE
 * enviado ao Storage. Devolver um `URL.createObjectURL` daqui gravaria um `blob:`
 * de sessão no snapshot imutável do documento — a foto sumiria no primeiro reload,
 * sem conserto possível.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/browser";
import { createMediaUploadUrl } from "@/app/actions/landing/media";
import { LANDING_MEDIA_ACCEPT, LANDING_MEDIA_BUCKET } from "@/lib/landing/media-config";
import { uploadImageBlob } from "@/lib/media/upload";
import {
  cutoutBackground,
  DEFAULT_TOLERANCE,
  type CutoutResult,
} from "@/lib/utils/background-removal";
import { CircleNotch, ImageIcon, Scissors, Trash, UploadSimple } from "@/lib/ui/icons";

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
}

export function ItemPhotoField({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [cutoutOpen, setCutoutOpen] = useState(false);
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
          disabled={uploading}
          className="flex items-center justify-center gap-1 text-[10px] text-text-muted transition-colors hover:text-accent disabled:opacity-50"
        >
          {uploading ? <CircleNotch size={10} className="animate-spin" /> : <UploadSimple size={10} />}
          {uploading ? "Enviando…" : value ? "Trocar" : "Enviar"}
        </button>

        {value ? (
          <button
            type="button"
            onClick={() => setCutoutOpen(true)}
            className="flex items-center justify-center gap-0.5 text-[9px] font-medium text-accent transition-colors hover:text-accent/80"
            title="Recortar o fundo da foto"
          >
            <Scissors size={9} /> Recortar fundo
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

      {cutoutOpen && value ? (
        <CutoutDialog
          sourceUrl={value}
          onClose={() => setCutoutOpen(false)}
          onApplied={(url) => {
            onChange(url);
            setCutoutOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Prévia do recorte com controle de tolerância.
 *
 * O algoritmo assume que os cantos da imagem são fundo. Em vez de esconder essa
 * limitação, a prévia mostra o resultado sobre xadrez para o usuário julgar antes
 * de gravar — e o aviso aparece quando quase nada ou quase tudo foi removido, que
 * são os dois sintomas de que a premissa não valeu para aquela foto.
 */
function CutoutDialog({
  sourceUrl,
  onClose,
  onApplied,
}: {
  sourceUrl: string;
  onClose: () => void;
  onApplied: (url: string) => void;
}) {
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  const [result, setResult] = useState<CutoutResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const run = useCallback(async (t: number) => {
    setBusy(true);
    setError(null);
    try {
      const next = await cutoutBackground(sourceUrl, { tolerance: t });
      setResult(next);
      // O objectURL aqui é só da PRÉVIA e é revogado ao trocar/fechar. O que vai
      // para o documento é a URL do Storage, gerada em `apply()`.
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(next.blob);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao recortar a imagem.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, [sourceUrl]);

  useEffect(() => {
    void run(tolerance);
    // Só na montagem: as mudanças de tolerância disparam por onPointerUp/onKeyUp,
    // para não reprocessar a imagem inteira a cada pixel arrastado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function apply() {
    if (!result) return;
    setSaving(true);
    try {
      const url = await uploadImageBlob(result.blob, "recorte.png");
      toast.success("Fundo recortado e imagem salva");
      onApplied(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar a imagem recortada.");
    } finally {
      setSaving(false);
    }
  }

  const ratio = result?.clearedRatio ?? 0;
  const suspicious = !busy && !error && (ratio < 0.02 || ratio > 0.95);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg rounded-xl border border-border bg-surface">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-foreground">Recortar fundo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div
            className="flex h-56 items-center justify-center rounded-lg border border-border"
            // Xadrez para enxergar a transparência sem depender de imagem externa.
            style={{
              backgroundImage:
                "linear-gradient(45deg,#c9ccd1 25%,transparent 25%),linear-gradient(-45deg,#c9ccd1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#c9ccd1 75%),linear-gradient(-45deg,transparent 75%,#c9ccd1 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0,0 8px,8px -8px,-8px 0px",
              backgroundColor: "#eef0f2",
            }}
          >
            {busy ? (
              <CircleNotch size={22} className="animate-spin text-text-muted" />
            ) : error ? (
              <p className="px-4 text-center text-xs text-error">{error}</p>
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Prévia do recorte" className="max-h-full max-w-full object-contain" />
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cutout-tolerance">
              Tolerância: <span className="font-mono">{tolerance}</span>
            </Label>
            <input
              id="cutout-tolerance"
              type="range"
              min={0}
              max={120}
              step={1}
              value={tolerance}
              disabled={saving}
              onChange={(e) => setTolerance(Number(e.target.value))}
              onPointerUp={() => void run(tolerance)}
              onKeyUp={() => void run(tolerance)}
              className="w-full accent-accent"
            />
            <p className="text-[11px] text-text-muted">
              Só o fundo contíguo às bordas é removido, então brilhos no meio da peça são
              preservados. Funciona bem com fundo liso; em fundo complexo, envie um PNG já
              transparente.
            </p>
          </div>

          {suspicious ? (
            <p className="rounded-lg bg-warning-bg px-3 py-2 text-[11px] text-warning-fg">
              {ratio < 0.02
                ? "Quase nada foi removido — aumente a tolerância ou o fundo não é uniforme."
                : "Quase toda a imagem foi removida — reduza a tolerância."}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="rounded-lg bg-accent text-xs font-semibold text-white hover:bg-accent/90"
            onClick={() => void apply()}
            disabled={busy || saving || !result}
          >
            {saving ? "Salvando…" : "Aplicar recorte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
