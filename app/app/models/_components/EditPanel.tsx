"use client";

/**
 * Painel de edição da peça: girar, escalar, espelhar e mover — e o histórico.
 *
 * A geometria já está carregada no visualizador, então a transformação acontece
 * AQUI, no browser, e sobe pronta. Não passa por Server Action: o limite de
 * corpo é 1 MB e um STL de peça média estoura isso com folga.
 *
 * Cada gravação cria uma VERSÃO nova; nada é sobrescrito. Ver
 * `app/actions/models/versions.ts` para o porquê.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowsClockwise, DownloadSimple, Warning } from "@/lib/ui/icons";
import { parseDecimal } from "@/lib/format/decimal";
import { createClient } from "@/lib/supabase/browser";
import { MODELS_BUCKET } from "@/lib/models/config";
import { createModelDownloadUrl } from "@/app/actions/models/actions";
import {
  createVersionUploadUrl,
  fetchModelVersions,
  restoreModelVersion,
  saveModelVersion,
  type ModelVersionRow,
} from "@/app/actions/models/versions";
import { parseMeshBuffer } from "@/lib/models/mesh";
import { boundsOf, signedMeshVolume, writeBinaryStl } from "@/lib/models/stl";
import {
  applyTransform,
  describeTransform,
  IDENTITY_TRANSFORM,
  isIdentityTransform,
  type Transform,
} from "@/lib/models/transform";

interface Props {
  // Só o que o painel realmente usa. Tipar por `Model3dRow` acoplaria este
  // componente a um formato de linha que ele nem lê.
  model: { id: string; name: string };
  /**
   * Chamado depois de gravar ou restaurar.
   *
   * Ao GRAVAR, recebe a geometria nova — ela já está aqui na memória, e passá-la
   * evita um download só para ver o que acabamos de calcular. Ao RESTAURAR vem
   * `undefined`: o arquivo daquela versão está no Storage e quem chama precisa
   * baixá-lo.
   */
  onChanged: (positions?: Float32Array) => void;
}

export function EditPanel({ model, onChanged }: Props) {
  const [t, setT] = useState<Transform>(IDENTITY_TRANSFORM);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [versions, setVersions] = useState<ModelVersionRow[]>([]);

  useEffect(() => {
    setT(IDENTITY_TRANSFORM);
    setNote("");
    let cancelled = false;
    void fetchModelVersions(model.id).then((r) => {
      if (!cancelled && r.ok) setVersions(r.versions);
    });
    return () => {
      cancelled = true;
    };
  }, [model.id]);

  const reload = async (positions?: Float32Array) => {
    const r = await fetchModelVersions(model.id);
    if (r.ok) setVersions(r.versions);
    onChanged(positions);
  };

  const setAxis = (
    field: "rotationDeg" | "scale" | "translationMm",
    axis: "x" | "y" | "z",
    value: number,
  ) => setT((prev) => ({ ...prev, [field]: { ...prev[field], [axis]: value } }));

  const mirror = (axis: "x" | "y" | "z") =>
    setT((prev) => ({ ...prev, scale: { ...prev.scale, [axis]: prev.scale[axis] * -1 } }));

  async function salvar() {
    if (isIdentityTransform(t)) {
      toast.error("Nada mudou. Ajuste rotação, escala ou posição primeiro.");
      return;
    }
    setBusy("Baixando a peça");
    try {
      // URL assinada: o cliente do browser não tem sessão (cookie httpOnly).
      const signedRead = await createModelDownloadUrl(model.id);
      if (!signedRead.ok) throw new Error(signedRead.error);
      const res = await fetch(signedRead.url);
      if (!res.ok) throw new Error(`Falha ao baixar (HTTP ${res.status})`);

      setBusy("Aplicando a transformação");
      const mesh = await parseMeshBuffer(await res.arrayBuffer(), model.name);
      const moved = applyTransform(mesh.positions, t);
      // Sempre STL binário na saída, mesmo se a entrada era 3MF: é o formato que
      // todo fatiador e toda impressora leem sem discussão.
      const stl = writeBinaryStl(moved, `${model.name} — editado`);

      setBusy("Enviando");
      const slot = await createVersionUploadUrl({ modelId: model.id });
      if (!slot.ok) throw new Error(slot.error);

      const supabase = createClient();
      const up = await supabase.storage
        .from(MODELS_BUCKET)
        .uploadToSignedUrl(slot.path, slot.token, new Blob([stl], { type: "model/stl" }));
      if (up.error) throw new Error(up.error.message);

      setBusy("Gravando a versão");
      const box = boundsOf(moved);
      const saved = await saveModelVersion({
        modelId: model.id,
        filePath: slot.path,
        sizeKb: Math.round(stl.byteLength / 1024),
        triangles: moved.length / 9,
        volumeCm3: signedMeshVolume(moved) / 1000,
        boundingBox: box,
        transform: t,
        note: note.trim() || describeTransform(t),
      });
      if (!saved.ok) throw new Error(saved.error);

      toast.success(`Versão ${saved.versionNumber} gravada`);
      setT(IDENTITY_TRANSFORM);
      setNote("");
      await reload(moved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui salvar a versão.");
    } finally {
      setBusy(null);
    }
  }

  async function restaurar(versionId: string, numero: number) {
    setBusy(`Voltando para a v${numero}`);
    try {
      const r = await restoreModelVersion({ modelId: model.id, versionId });
      if (!r.ok) throw new Error(r.error);
      toast.success(`Peça voltou para a versão ${numero}`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui restaurar.");
    } finally {
      setBusy(null);
    }
  }

  const previa = describeTransform(t);
  const espelhado = t.scale.x < 0 || t.scale.y < 0 || t.scale.z < 0;

  return (
    <div className="space-y-4">
      <Trio
        titulo="Girar"
        sufixo="°"
        valores={t.rotationDeg}
        onChange={(axis, v) => setAxis("rotationDeg", axis, v)}
      />
      <Trio
        titulo="Escala"
        sufixo="×"
        valores={t.scale}
        onChange={(axis, v) => setAxis("scale", axis, v)}
      />
      <Trio
        titulo="Mover"
        sufixo="mm"
        valores={t.translationMm}
        onChange={(axis, v) => setAxis("translationMm", axis, v)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Espelhar
        </span>
        {(["x", "y", "z"] as const).map((axis) => (
          <Button
            key={axis}
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => mirror(axis)}
          >
            {axis.toUpperCase()}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => setT(IDENTITY_TRANSFORM)}
        >
          Zerar
        </Button>
      </div>

      {espelhado && (
        <p className="flex gap-2 rounded-lg border border-border bg-muted/40 p-2 text-[10px] leading-snug text-muted-foreground">
          <Warning size={14} className="mt-0.5 shrink-0" aria-hidden />
          Espelhar inverte o sentido dos triângulos. A ordem dos vértices é corrigida na
          gravação, senão a peça sairia com o lado de dentro para fora — e nada acusaria.
        </p>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Nota da versão</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={previa}
          maxLength={300}
        />
        <p className="text-[10px] text-muted-foreground">Em branco, grava: {previa}</p>
      </div>

      <Button
        onClick={() => void salvar()}
        disabled={busy !== null || isIdentityTransform(t)}
        className="w-full gap-2"
      >
        {busy ? <ArrowsClockwise size={15} className="animate-spin" /> : null}
        {busy ?? "Salvar como nova versão"}
      </Button>

      {versions.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico
          </p>
          <ul className="space-y-1.5">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border p-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">v{v.versionNumber}</span>
                    {v.isCurrent && (
                      <Badge variant="secondary" className="text-[9px]">atual</Badge>
                    )}
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">{v.note}</p>
                  <p className="text-[10px] tabular-nums text-muted-foreground">
                    {v.triangles.toLocaleString("pt-BR")} tri · {v.sizeKb.toLocaleString("pt-BR")} kB
                  </p>
                </div>
                {!v.isCurrent && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 px-2 text-[11px]"
                    disabled={busy !== null}
                    onClick={() => void restaurar(v.id, v.versionNumber)}
                  >
                    Voltar
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="flex gap-1.5 text-[10px] text-muted-foreground">
            <DownloadSimple size={12} className="mt-0.5 shrink-0" aria-hidden />
            Voltar não apaga nada: só muda qual arquivo a peça usa.
          </p>
        </div>
      )}
    </div>
  );
}

function Trio({
  titulo,
  sufixo,
  valores,
  onChange,
}: {
  titulo: string;
  sufixo: string;
  valores: { x: number; y: number; z: number };
  onChange: (axis: "x" | "y" | "z", value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {titulo} <span className="text-muted-foreground">({sufixo})</span>
      </Label>
      <div className="grid grid-cols-3 gap-2">
        {(["x", "y", "z"] as const).map((axis) => (
          <div key={axis} className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase text-muted-foreground">
              {axis}
            </span>
            <Input
              inputMode="decimal"
              className="pl-6 text-xs tabular-nums"
              value={String(valores[axis])}
              onChange={(e) => onChange(axis, parseDecimal(e.target.value))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
