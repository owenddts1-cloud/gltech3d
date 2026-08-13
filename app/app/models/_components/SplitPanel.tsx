"use client";

/**
 * Separar a peça em partes soltas — o `P → By Loose Parts` do Blender.
 *
 * ROda TUDO NO BROWSER, como o `EditPanel`, e pelo mesmo motivo: a geometria
 * pode ter dezenas de MB e o corpo de uma Server Action é limitado a 1 MB. O
 * servidor só entra para assinar o upload e gravar a linha.
 *
 * NÃO MEXE NA PEÇA ORIGINAL. Cada parte vira um MODELO NOVO, na mesma pasta. Um
 * "separar" que substituísse o arquivo destruiria o único lugar onde as peças
 * ainda estão posicionadas umas em relação às outras — e ninguém remonta isso
 * depois.
 */

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ArrowsClockwise, ArrowsOutSimple, Warning } from "@/lib/ui/icons";
import { createClient } from "@/lib/supabase/browser";
import { MODELS_BUCKET } from "@/lib/models/config";
import {
  createModelDownloadUrl,
  createModelUploadUrl,
  saveModel,
} from "@/app/actions/models/actions";
import { parseMeshBuffer } from "@/lib/models/mesh";
import { writeBinaryStl } from "@/lib/models/stl";
import { splitLooseParts, type MeshPart } from "@/lib/models/split";

/** O que a lista precisa saber sobre cada peça criada. */
export interface CreatedPart {
  id: string;
  name: string;
  sizeKb: number;
  triangles: number;
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  filePath: string;
  volumeCm3: number;
  createdAt: string;
  folderId?: string | null;
  /** Geometria já em memória: evita rebaixar o que acabamos de calcular. */
  positions: Float32Array;
}

interface Props {
  model: { id: string; name: string; folderId?: string | null };
  /** Recebe as peças criadas, para a lista já mostrá-las sem recarregar a página. */
  onCreated: (parts: CreatedPart[]) => void;
}

/** Descarta caco: face solta e triângulo degenerado não são peça imprimível. */
const MIN_TRIANGLES = 4;

export function SplitPanel({ model, onCreated }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [partes, setPartes] = useState<MeshPart[] | null>(null);

  async function analisar() {
    setBusy("Baixando a peça");
    try {
      // URL assinada: o cliente do browser não tem sessão (cookie httpOnly).
      const signedRead = await createModelDownloadUrl(model.id);
      if (!signedRead.ok) throw new Error(signedRead.error);
      const res = await fetch(signedRead.url);
      if (!res.ok) throw new Error(`Falha ao baixar (HTTP ${res.status})`);

      setBusy("Procurando partes soltas");
      const mesh = await parseMeshBuffer(await res.arrayBuffer(), model.name);
      const achadas = splitLooseParts(mesh.positions, { minTriangles: MIN_TRIANGLES });

      setPartes(achadas);
      if (achadas.length <= 1) {
        toast.info("Esta peça é inteiriça: não há partes soltas para separar.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui analisar a peça.");
    } finally {
      setBusy(null);
    }
  }

  async function separar() {
    if (!partes || partes.length <= 1) return;
    setBusy(`Criando ${partes.length} peças`);

    const base = model.name.replace(/\.(stl|3mf)$/i, "");
    const criadas: CreatedPart[] = [];

    try {
      for (const [i, parte] of partes.entries()) {
        const nome = `${base} — parte ${i + 1}.stl`;
        setBusy(`Enviando ${i + 1} de ${partes.length}`);

        const stl = writeBinaryStl(parte.positions, nome);
        const slot = await createModelUploadUrl({
          filename: nome,
          sizeBytes: stl.byteLength,
        });
        if (!slot.ok) throw new Error(slot.error);

        const supabase = createClient();
        const up = await supabase.storage
          .from(MODELS_BUCKET)
          .uploadToSignedUrl(slot.path, slot.token, new Blob([stl], { type: "model/stl" }));
        if (up.error) throw new Error(up.error.message);

        const saved = await saveModel({
          name: nome,
          filePath: slot.path,
          sizeKb: Math.round(stl.byteLength / 1024),
          triangles: parte.triangles,
          volumeCm3: parte.volumeMm3 / 1000,
          boundingBox: parte.boundingBox,
          folderId: model.folderId ?? null,
          mimeType: "model/stl",
        });
        if (!saved.ok) throw new Error(saved.error);
        criadas.push({
          id: saved.model.id,
          name: saved.model.name,
          sizeKb: saved.model.sizeKb,
          triangles: saved.model.triangles,
          boundingBox: saved.model.boundingBox,
          filePath: saved.model.filePath,
          volumeCm3: saved.model.volumeCm3,
          createdAt: saved.model.createdAt,
          folderId: model.folderId ?? null,
          positions: parte.positions,
        });
      }

      toast.success(`${criadas.length} peças criadas. A original continua intacta.`);
      setPartes(null);
      onCreated(criadas);
    } catch (err) {
      // Falha no meio deixa as peças já criadas de pé — e dizer isso importa,
      // senão o usuário repete a operação e duplica tudo.
      const detalhe =
        criadas.length > 0 ? ` ${criadas.length} peça(s) já foram criadas.` : "";
      toast.error(
        (err instanceof Error ? err.message : "Não consegui separar a peça.") + detalhe,
      );
      if (criadas.length > 0) onCreated(criadas);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] leading-snug text-muted-foreground">
        Separa componentes que não se tocam — o corpo, a tampa, os parafusos. Duas faces são
        da mesma peça quando compartilham uma aresta; encostar só num vértice não conta.
      </p>

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        disabled={busy !== null}
        onClick={() => void analisar()}
      >
        {busy ? (
          <ArrowsClockwise size={15} className="animate-spin" />
        ) : (
          <ArrowsOutSimple size={15} />
        )}
        {busy ?? "Procurar partes soltas"}
      </Button>

      {partes !== null && partes.length <= 1 && (
        <p className="flex gap-2 rounded-lg border border-border bg-muted/40 p-2 text-[10px] leading-snug text-muted-foreground">
          <Warning size={14} className="mt-0.5 shrink-0" aria-hidden />
          Peça inteiriça — uma parte só. Não há o que separar.
        </p>
      )}

      {partes !== null && partes.length > 1 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {partes.length} partes encontradas
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {partes.map((p, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-[11px] tabular-nums"
              >
                <span className="font-medium">Parte {i + 1}</span>
                <span className="text-muted-foreground">
                  {(p.volumeMm3 / 1000).toFixed(2)} cm³ · {p.triangles.toLocaleString("pt-BR")} tri
                </span>
              </li>
            ))}
          </ul>

          <Button
            size="sm"
            className="w-full"
            disabled={busy !== null}
            onClick={() => void separar()}
          >
            Salvar como {partes.length} peças
          </Button>
          <p className="text-[10px] text-muted-foreground">
            A peça original não é alterada nem apagada.
          </p>
        </div>
      )}
    </div>
  );
}
