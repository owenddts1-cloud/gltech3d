"use client";

import { useState, useRef } from "react";
import dynamicImport from "next/dynamic";
import { 
  Cube, 
  Eye, 
  Trash, 
  Plus, 
  Info, 
  ArrowsClockwise,
  Gear,
  DownloadSimple,
  PencilSimple,
} from "@/lib/ui/icons";
import {
  Sun,
  Layers,
  RotateCw,
  Sparkles
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";
import {
  createModelUploadUrl,
  saveModel,
  deleteModel,
  createModelDownloadUrl,
  renameFile,
} from "@/app/actions/models/actions";
import { MODELS_BUCKET, type Model3dRow } from "@/lib/models/config";
// Uma implementação só, e testada (lib/models/stl.test.ts). Havia uma cópia
// deste cálculo aqui dentro, sem teste.
import { write3mf } from "@/lib/models/threemf";
import { parseMeshBuffer } from "@/lib/models/mesh";
import { signedMeshVolume } from "@/lib/models/stl";
import {
  VIEW_MODES,
  MATERIAL_PRESETS,
  STUDIO_ANGLES,
  type ViewMode,
  type MaterialPresetId,
  type StudioAngle,
} from "@/lib/models/viewer-presets";
import type { ViewerApi } from "./ThreeViewer";
import { EditPanel } from "./EditPanel";
import { boundsOf as boundsOfMesh } from "@/lib/models/stl";

// Lazy-load ThreeViewer to keep initial page bundle small and prevent SSR errors
const ThreeViewer = dynamicImport(() => import("./ThreeViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex flex-col items-center justify-center bg-surface/60 border border-border rounded-lg">
      <ArrowsClockwise className="h-8 w-8 text-accent animate-spin mb-2" />
      <p className="text-xs text-muted-foreground">Carregando renderizador WebGL/Three.js...</p>
    </div>
  )
});

interface StlModel {
  id: string;
  name: string;
  sizeKb: number;
  triangles: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  thumbnailUrl: string;
  /** Geometria em memória. Ausente em modelo recém-carregado do banco —
   *  baixado e reparseado sob demanda ao inspecionar. */
  positions?: Float32Array;
  /** Caminho no Storage; presente quando persistido. */
  filePath?: string;
  volumeCm3: number;
  uploadedAt: string;
}

/** Parseia um STL (ArrayBuffer) no Web Worker → positions + boundingBox. */
/**
 * Lê a malha — STL binário, STL ASCII ou 3MF.
 *
 * Chamava-se `parseStl` e o nome ficou mentiroso: o worker usa `parseMeshBuffer`
 * desde que o 3MF entrou, e lê os três. Nome errado em função que decide formato
 * é o tipo de coisa que faz alguém "consertar" de volta para só STL.
 */
function parseMesh(
  arrayBuffer: ArrayBuffer,
  filename: string,
): Promise<{ positions: Float32Array; boundingBox: StlModel["boundingBox"]; numTriangles: number }> {
  return new Promise((resolve, reject) => {
    // Worker bundleado: importa `lib/models/mesh.ts`, que é testado. Antes era o
    // script solto `/workers/stl-parser.js`, que só lia STL binário.
    const worker = new Worker(new URL("./stl.worker.ts", import.meta.url), { type: "module" });
    // O nome vai junto: sem ele o parser decide só pela assinatura do arquivo, e
    // um `.3mf` corrompido falharia como "não reconheci" em vez de dizer que o
    // pacote ZIP está quebrado.
    worker.postMessage({ arrayBuffer, filename });
    worker.onmessage = (e) => {
      worker.terminate();
      if (!e.data.ok) return reject(new Error(e.data.error ?? "Falha ao ler a malha"));
      resolve({
        positions: new Float32Array(e.data.positions),
        boundingBox: e.data.boundingBox,
        numTriangles: e.data.numTriangles,
      });
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("Erro no worker de parsing"));
    };
  });
}

function SpotlightCard({ children, className, ...props }: { children: React.ReactNode, className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isFocused, setIsFocused] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-5 shadow-lg backdrop-blur-md transition-all duration-300",
        className
      )}
      {...props}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300"
        style={{
          opacity: isFocused ? 1 : 0,
          background: `radial-gradient(350px circle at ${coords.x}px ${coords.y}px, rgba(255, 107, 0, 0.12), transparent 80%)`,
        }}
      />
      {children}
    </div>
  );
}

export function ModelsClient({
  initialModels,
  loadError = null,
}: {
  initialModels: Model3dRow[];
  /** Erro do servidor ao listar. Null = listou (mesmo que vazio). */
  loadError?: string | null;
}) {
  const [models, setModels] = useState<StlModel[]>(() =>
    initialModels.map((m) => ({
      id: m.id,
      name: m.name,
      sizeKb: m.sizeKb,
      triangles: m.triangles,
      boundingBox: m.boundingBox,
      thumbnailUrl: m.thumbnailUrl ?? "",
      filePath: m.filePath,
      volumeCm3: m.volumeCm3,
      uploadedAt: m.createdAt,
      // positions carregadas sob demanda (parseStl) ao inspecionar
    })),
  );
  const [activeInspector, setActiveInspector] = useState<StlModel | null>(null);
  // Por ID, nao booleano global: antes um clique desabilitava o botao de TODOS
  // os cards ao mesmo tempo.
  const [loadingInspector, setLoadingInspector] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("solid");
  const [materialPreset, setMaterialPreset] = useState<MaterialPresetId>("filamento-fosco");
  const [studio, setStudio] = useState(false);
  const [capturing, setCapturing] = useState(false);
  // A API do viewer chega por callback quando a cena monta. Num ref porque
  // trocá-la não deve provocar render.
  const viewerApi = useRef<ViewerApi | null>(null);
  const [inspectorRotate, setInspectorRotate] = useState(true);
  
  // Advanced simulation states
  const [sliceHeightPercent, setSliceHeightPercent] = useState(100);
  const [dirLightIntensity, setDirLightIntensity] = useState(0.8);
  const [ambientLightIntensity, setAmbientLightIntensity] = useState(0.6);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [rotateZ, setRotateZ] = useState(0);

  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to project 3D points to 2D for a cool vector preview thumbnail
  function drawStlThumbnail(
    positions: Float32Array,
    min: [number, number, number],
    max: [number, number, number]
  ): string {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 220;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const grad = ctx.createLinearGradient(0, 0, 300, 220);
    grad.addColorStop(0, "#09090b");
    grad.addColorStop(1, "#18181b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 300, 220);

    const cx = (min[0] + max[0]) / 2;
    const cy = (min[1] + max[1]) / 2;
    const cz = (min[2] + max[2]) / 2;
    const dx = max[0] - min[0] || 1;
    const dy = max[1] - min[1] || 1;
    const dz = max[2] - min[2] || 1;
    const maxDim = Math.max(dx, dy, dz);
    const scale = 95 / maxDim;

    ctx.strokeStyle = "rgba(249, 115, 22, 0.45)"; // Orange tone
    ctx.lineWidth = 1;
    ctx.beginPath();

    const step = Math.max(3, Math.floor(positions.length / 2000)) * 3;
    for (let i = 0; i < positions.length; i += step) {
      if (i + 8 >= positions.length) break;

      const pts = [];
      for (let v = 0; v < 3; v++) {
        const idx = i + v * 3;
        const x = (positions[idx]! - cx) * scale;
        const y = (positions[idx+1]! - cy) * scale;
        const z = (positions[idx+2]! - cz) * scale;

        // Apply a isometric/orthographic rotation
        const angleY = 0.55;
        const rx = x * Math.cos(angleY) - z * Math.sin(angleY);
        const rz = x * Math.sin(angleY) + z * Math.cos(angleY);

        const angleX = 0.35;
        const ry = y * Math.cos(angleX) - rz * Math.sin(angleX);

        const px = 150 + rx;
        const py = 110 - ry;
        pts.push({ px, py });
      }

      ctx.moveTo(pts[0]!.px, pts[0]!.py);
      ctx.lineTo(pts[1]!.px, pts[1]!.py);
      ctx.lineTo(pts[2]!.px, pts[2]!.py);
      ctx.closePath();
    }
    ctx.stroke();

    // Render wireframe boundaries box
    ctx.fillStyle = "rgba(244, 244, 245, 0.85)";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(`${dx.toFixed(1)} x ${dy.toFixed(1)} x ${dz.toFixed(1)} mm`, 12, 204);

    return canvas.toDataURL("image/webp");
  }

  // Envio de STL: parseia no worker, sobe o arquivo pro Storage e grava os
  // metadados no banco. Antes ficava só na memória (sumia ao recarregar).
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    // ANTES: só `.stl`. Todo o resto do caminho já aceitava 3MF — o backend
    // (`ALLOWED_EXT`), o worker do visualizador, o worker do fatiador e
    // `fetchSliceableModels`. O acervo tinha 2 arquivos, os dois STL, não por
    // preferência: o botão recusava o resto.
    const nome = file.name.toLowerCase();
    if (!nome.endsWith(".stl") && !nome.endsWith(".3mf")) {
      toast.error("Envie um arquivo STL ou 3MF.");
      return;
    }

    setIsParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { positions, boundingBox, numTriangles } = await parseMesh(arrayBuffer, file.name);

      // Volume real = soma dos tetraedros com sinal (não mais "mock voxel").
      const volumeCm3 = parseFloat((signedMeshVolume(positions) / 1000).toFixed(1));
      const thumbnailUrl = drawStlThumbnail(positions, boundingBox.min, boundingBox.max);

      // 1. URL assinada + upload direto ao Storage
      const signed = await createModelUploadUrl({ filename: file.name, sizeBytes: file.size });
      if (!signed.ok) {
        toast.error(signed.error);
        return;
      }
      const supabase = createClient();
      const up = await supabase.storage
        .from(MODELS_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (up.error) {
        toast.error(up.error.message);
        return;
      }

      // 2. Grava os metadados
      const saved = await saveModel({
        name: file.name,
        filePath: signed.path,
        sizeKb: Math.round(file.size / 1024),
        triangles: numTriangles,
        volumeCm3,
        boundingBox,
        thumbnailUrl,
      });
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }

      // Guarda o id real do banco + as positions em memória (evita rebaixar).
      setModels((prev) => [
        {
          id: saved.model.id,
          name: saved.model.name,
          sizeKb: saved.model.sizeKb,
          triangles: saved.model.triangles,
          boundingBox: saved.model.boundingBox,
          thumbnailUrl: saved.model.thumbnailUrl ?? thumbnailUrl,
          filePath: saved.model.filePath,
          positions,
          volumeCm3: saved.model.volumeCm3,
          uploadedAt: saved.model.createdAt,
        },
        ...prev,
      ]);
      toast.success(`Modelo "${file.name}" salvo.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao processar o STL.");
    } finally {
      setIsParsing(false);
    }
  };

  // Inspeciona: se as positions não estão em memória (modelo veio do banco),
  // baixa o STL do Storage e reparseia sob demanda.
  const openInspector = async (model: StlModel) => {
    setSliceHeightPercent(100);
    setRotateX(0);
    setRotateY(0);
    setRotateZ(0);

    if (model.positions) {
      setActiveInspector(model);
      return;
    }
    if (!model.filePath) {
      toast.error("Arquivo indisponível para inspeção.");
      return;
    }

    setLoadingInspector(model.id);
    try {
      // URL assinada emitida no SERVIDOR. O cliente Supabase do browser não tem
      // sessão (cookie httpOnly), então `storage.download()` daqui era sempre
      // negado pelo bucket privado — era exatamente o bug de "não abre em outro
      // dispositivo". A assinatura vai na URL, então um fetch puro resolve.
      const signed = await createModelDownloadUrl(model.id);
      if (!signed.ok) throw new Error(signed.error);
      const res = await fetch(signed.url);
      if (!res.ok) throw new Error(`Falha ao baixar o STL (HTTP ${res.status})`);
      const { positions } = await parseMesh(await res.arrayBuffer(), model.name);
      const withGeom = { ...model, positions };
      // Cacheia as positions na lista pra não rebaixar na próxima abertura.
      setModels((prev) => prev.map((m) => (m.id === model.id ? withGeom : m)));
      setActiveInspector(withGeom);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar a geometria.");
    } finally {
      setLoadingInspector(null);
    }
  };

  /**
   * A peça mudou de versão: atualiza o que está na tela.
   *
   * Ao GRAVAR, a geometria nova vem junto e entra direto — baixá-la de novo
   * seria pedir ao servidor o que acabamos de calcular aqui. Ao RESTAURAR não
   * vem geometria: limpamos o cache e reabrimos, e o `openInspector` resolve o
   * caminho atual pelo ID no servidor, que já aponta para a versão restaurada.
   */
  const applyVersionChange = async (positions?: Float32Array) => {
    const atual = activeInspector;
    if (!atual) return;

    if (positions) {
      const bb = boundsOfMesh(positions);
      const atualizado: StlModel = {
        ...atual,
        positions,
        triangles: positions.length / 9,
        boundingBox: bb,
      };
      setModels((prev) => prev.map((m) => (m.id === atualizado.id ? atualizado : m)));
      setActiveInspector(atualizado);
      return;
    }

    const semGeometria: StlModel = { ...atual, positions: undefined };
    setModels((prev) => prev.map((m) => (m.id === semGeometria.id ? semGeometria : m)));
    await openInspector(semGeometria);
  };

  /** Baixa o arquivo original. Mesma URL assinada; o servidor manda o nome. */
  const downloadModel = async (model: StlModel) => {
    setDownloading(model.id);
    try {
      const signed = await createModelDownloadUrl(model.id);
      if (!signed.ok) throw new Error(signed.error);
      const a = document.createElement("a");
      a.href = signed.url;
      a.download = signed.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível baixar o arquivo.");
    } finally {
      setDownloading(null);
    }
  };

  /**
   * Converte a peça para 3MF e baixa.
   *
   * POR QUE VALE A PENA. STL guarda triângulos soltos e mais nada: sem unidade
   * declarada (é milímetro? polegada? o arquivo não diz), sem transformação, e
   * repetindo cada vértice em cada face que o toca. 3MF traz a unidade, indexa o
   * vértice uma vez e é o que os fatiadores modernos preferem.
   *
   * O escritor (`write3mf`) tinha 20 testes e fixtures geradas por outra
   * ferramenta desde a rodada do 3MF — e não era chamado por lugar nenhum. Este
   * botão é a porta que faltava.
   */
  const downloadAs3mf = async (model: StlModel) => {
    setDownloading(model.id);
    try {
      // URL assinada emitida no servidor: o cliente do browser não tem sessão.
      const signed = await createModelDownloadUrl(model.id);
      if (!signed.ok) throw new Error(signed.error);
      const res = await fetch(signed.url);
      if (!res.ok) throw new Error(`Falha ao baixar (HTTP ${res.status})`);

      const mesh = await parseMeshBuffer(await res.arrayBuffer(), model.name);
      const base = model.name.replace(/\.[^.]+$/, "") || "peca";
      const pacote = write3mf(mesh.positions, base);

      saveBlob(new Blob([pacote as BlobPart], { type: "model/3mf" }), `${base}.3mf`);
      toast.success(`3MF gerado com ${mesh.numTriangles.toLocaleString("pt-BR")} triângulos.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui converter para 3MF.");
    } finally {
      setDownloading(null);
    }
  };

  /** Nome de arquivo seguro para a foto, derivado do nome do modelo. */
  function photoName(model: StlModel, suffix: string): string {
    const base = model.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 60);
    return `${base || "modelo"}-${suffix}.png`;
  }

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Sem revoke, cada foto segura o blob na memória até a aba fechar.
    URL.revokeObjectURL(url);
  }

  /** Foto do ângulo em que a câmera está agora. */
  const captureOne = async () => {
    const api = viewerApi.current;
    const model = activeInspector;
    if (!api || !model) return;
    setCapturing(true);
    try {
      saveBlob(await api.capture({ scale: 2 }), photoName(model, "vista"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui gerar a imagem.");
    } finally {
      setCapturing(false);
    }
  };

  /** As 6 vistas canônicas, uma a uma. */
  const captureAllAngles = async () => {
    const api = viewerApi.current;
    const model = activeInspector;
    if (!api || !model) return;
    setCapturing(true);
    try {
      for (const angle of STUDIO_ANGLES) {
        api.setAngle(angle.id);
        // Um frame para a câmera assentar antes de capturar; sem isto as
        // primeiras fotos saem do ângulo anterior.
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        saveBlob(await api.capture({ scale: 2 }), photoName(model, angle.id));
      }
      toast.success("6 vistas geradas.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui gerar as vistas.");
    } finally {
      setCapturing(false);
    }
  };

  /** Renomeia. `renameFile` já existia em actions.ts e nunca fora chamada. */
  const handleRename = async (model: StlModel) => {
    const next = window.prompt("Novo nome do arquivo:", model.name);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === model.name) return;

    const snapshot = models;
    setRenamingId(model.id);
    setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, name: trimmed } : m)));
    const res = await renameFile({ id: model.id, name: trimmed });
    setRenamingId(null);
    if (!res.ok) {
      setModels(snapshot);
      toast.error(res.error);
      return;
    }
    toast.success("Nome atualizado.");
  };

  const removeModel = async (id: string) => {
    const snapshot = models;
    setModels((prev) => prev.filter((m) => m.id !== id));
    if (activeInspector?.id === id) setActiveInspector(null);

    const res = await deleteModel(id);
    if (!res.ok) {
      setModels(snapshot); // rollback
      toast.error(res.error);
      return;
    }
    toast.success("Modelo removido.");
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Cube className="text-accent" />
            Repositório de Modelos 3D
          </h1>
          <p className="text-sm text-muted-foreground">
            Envie arquivos STL. Eles são processados em segundo plano via Web Worker para evitar travamento da tela.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".stl,.3mf"
            className="hidden"
            id="stl-upload-input"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isParsing}
            className="gap-2 bg-accent hover:bg-accent-hover text-white font-medium"
          >
            <Plus className="h-4 w-4" />
            {isParsing ? "Analisando STL..." : "Adicionar Arquivo STL"}
          </Button>
        </div>
      </header>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map((model) => (
          <SpotlightCard key={model.id} className="overflow-hidden border border-border bg-surface/60 hover:border-border transition-all flex flex-col justify-between p-0 rounded-2xl">
            {/* Thumbnail Canvas render — data URL webp gerada no cliente,
                next/image não se aplica. */}
            <div className="relative aspect-video w-full border-b border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={model.thumbnailUrl}
                alt={model.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="bg-surface/90 text-muted-foreground border border-border text-[10px]">
                  {model.sizeKb} KB
                </Badge>
              </div>
            </div>

            {/* Model Description */}
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-sm text-foreground truncate" title={model.name}>
                  {model.name}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Triângulos: {model.triangles.toLocaleString()} | Volume aproximado: {model.volumeCm3} cm³
                </p>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  onClick={() => openInspector(model)}
                  disabled={loadingInspector === model.id}
                  className="flex-1 text-xs gap-1.5 bg-accent-soft hover:bg-accent/20 text-accent border border-accent/20 rounded-xl"
                >
                  <Eye size={14} />
                  {loadingInspector === model.id ? "Carregando…" : "Inspecionar 3D"}
                </Button>
                <Button
                  onClick={() => void downloadModel(model)}
                  disabled={downloading === model.id}
                  variant="outline"
                  title="Baixar o arquivo original"
                  aria-label={`Baixar ${model.name}`}
                  className="p-2 rounded-xl"
                >
                  <DownloadSimple size={14} />
                </Button>
                <Button
                  onClick={() => void downloadAs3mf(model)}
                  disabled={downloading === model.id}
                  variant="outline"
                  title="Converter e baixar como 3MF (declara unidade e indexa vértices)"
                  aria-label={`Baixar ${model.name} como 3MF`}
                  className="p-2 rounded-xl text-[10px] font-bold"
                >
                  3MF
                </Button>
                <Button
                  onClick={() => void handleRename(model)}
                  disabled={renamingId === model.id}
                  variant="outline"
                  title="Renomear"
                  aria-label={`Renomear ${model.name}`}
                  className="p-2 rounded-xl"
                >
                  <PencilSimple size={14} />
                </Button>
                <Button
                  onClick={() => removeModel(model.id)}
                  variant="outline"
                  title="Excluir"
                  aria-label={`Excluir ${model.name}`}
                  className="p-2 border-red-500/20 hover:bg-red-500/10 text-red-400 rounded-xl"
                >
                  <Trash size={14} />
                </Button>
              </div>
            </div>
          </SpotlightCard>
        ))}

        {models.length === 0 && loadError && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-500/40 bg-red-500/5 p-12 text-center">
            <Info className="mb-3 h-12 w-12 text-red-400" />
            <h3 className="font-semibold text-red-400">Não consegui carregar seus arquivos</h3>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Isto <strong>não</strong> significa que os arquivos foram perdidos — é uma falha de
              leitura. Motivo: <span className="font-mono">{loadError}</span>
            </p>
          </div>
        )}

        {models.length === 0 && !loadError && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-2xl text-center bg-muted/30">
            <Cube className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-muted-foreground">Nenhum arquivo 3D enviado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Faça o upload de arquivos STL para visualizar a geometria em 3D. Cada arquivo é salvo e fica disponível ao recarregar.
            </p>
          </div>
        )}
      </div>

      {/* 3D Inspector Modal (Lazy-Loaded Three.js Viewport) */}
      {activeInspector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <Card className="max-w-5xl w-full p-6 space-y-4 bg-surface border border-border shadow-2xl flex flex-col h-[90vh] rounded-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Sparkles className="text-accent h-5 w-5" />
                  {activeInspector.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dimensões máximas: {
                    (activeInspector.boundingBox.max[0] - activeInspector.boundingBox.min[0]).toFixed(1)
                  }x{
                    (activeInspector.boundingBox.max[1] - activeInspector.boundingBox.min[1]).toFixed(1)
                  }x{
                    (activeInspector.boundingBox.max[2] - activeInspector.boundingBox.min[2]).toFixed(1)
                  } mm
                </p>
              </div>
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setActiveInspector(null)}>Fechar Visualizador</Button>
            </div>

            {/* Visualizer and settings container */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 overflow-hidden">
              {/* WebGL Canvas viewport */}
              <div className="md:col-span-3 h-full relative rounded-xl overflow-hidden border border-border bg-muted/30 shadow-inner">
                <ThreeViewer
                  positions={activeInspector.positions!}
                  boundingBox={activeInspector.boundingBox}
                  viewMode={viewMode}
                  materialPreset={materialPreset}
                  studio={studio}
                  autoRotate={inspectorRotate}
                  sliceHeightPercent={sliceHeightPercent}
                  dirLightIntensity={dirLightIntensity}
                  ambientLightIntensity={ambientLightIntensity}
                  rotateX={rotateX}
                  rotateY={rotateY}
                  rotateZ={rotateZ}
                  onApiReady={(api) => { viewerApi.current = api; }}
                />
              </div>

              {/* Viewport Config panel */}
              <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-5 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  <details className="group rounded-lg border border-border bg-surface/60">
                    <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground">
                      Editar peça
                      <span className="ml-1 font-normal normal-case text-muted-foreground">
                        — girar, escalar, espelhar
                      </span>
                    </summary>
                    <div className="border-t border-border p-3">
                      <EditPanel
                        model={activeInspector}
                        onChanged={(positions) => { void applyVersionChange(positions); }}
                      />
                    </div>
                  </details>

                  <h4 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center gap-1.5 border-b border-border pb-2">
                    <Gear className="text-accent" />
                    Controles e Fatiamento
                  </h4>

                  {/* Slicing Simulator Z */}
                  <div className="space-y-1.5">
                    <Label htmlFor="slice-range" className="text-[11px] text-muted-foreground font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Layers size={13} className="text-accent" />
                        Fatiar Altura (Z)
                      </span>
                      <span className="text-accent font-bold">{sliceHeightPercent}%</span>
                    </Label>
                    <input
                      id="slice-range"
                      type="range"
                      min="0"
                      max="100"
                      value={sliceHeightPercent}
                      onChange={(e) => setSliceHeightPercent(Number(e.target.value))}
                      className="w-full accent-accent bg-muted rounded-lg cursor-pointer h-1.5"
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <Label htmlFor="view-mode-select">Como visualizar</Label>
                    <select
                      id="view-mode-select"
                      value={viewMode}
                      onChange={(e) => setViewMode(e.target.value as ViewMode)}
                      className="w-full rounded-md border border-border bg-surface p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      {VIEW_MODES.map((m) => (
                        <option key={m.id} value={m.id} className="bg-surface">{m.label}</option>
                      ))}
                    </select>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      {VIEW_MODES.find((m) => m.id === viewMode)?.hint}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="material-select">Material</Label>
                    <select
                      id="material-select"
                      value={materialPreset}
                      onChange={(e) => setMaterialPreset(e.target.value as MaterialPresetId)}
                      disabled={viewMode === "normals" || viewMode === "matcap"}
                      className="w-full rounded-md border border-border bg-surface p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                    >
                      {MATERIAL_PRESETS.map((m) => (
                        <option key={m.id} value={m.id} className="bg-surface">{m.label}</option>
                      ))}
                    </select>
                    {(viewMode === "normals" || viewMode === "matcap") && (
                      <p className="text-[10px] text-muted-foreground">
                        Este modo tem sombreamento próprio — o material não se aplica.
                      </p>
                    )}
                  </div>

                  {/* ── Foto de produto ──────────────────────────────────── */}
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="studio-toggle" className="cursor-pointer text-[11px] text-muted-foreground">
                        Estúdio (fundo branco)
                      </Label>
                      <input
                        id="studio-toggle"
                        type="checkbox"
                        checked={studio}
                        onChange={(e) => setStudio(e.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-border bg-surface text-accent focus:ring-accent"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      {STUDIO_ANGLES.map((a) => (
                        <Button
                          key={a.id}
                          variant="outline"
                          onClick={() => viewerApi.current?.setAngle(a.id)}
                          className="h-7 px-1 text-[10px]"
                        >
                          {a.label}
                        </Button>
                      ))}
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        disabled={capturing}
                        onClick={() => void captureOne()}
                        className="h-8 flex-1 gap-1 text-[10px]"
                      >
                        <DownloadSimple size={12} /> PNG 2×
                      </Button>
                      <Button
                        variant="outline"
                        disabled={capturing}
                        onClick={() => void captureAllAngles()}
                        className="h-8 flex-1 text-[10px]"
                      >
                        {capturing ? "Gerando…" : "As 6 vistas"}
                      </Button>
                    </div>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Serve de foto de produto para Shopee e Instagram.
                    </p>
                  </div>

                  {/* manual rotation controls */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block flex items-center gap-1">
                      <RotateCw size={11} className="text-accent" />
                      Orientação Manual
                    </span>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <Label htmlFor="rot-x">Eixo X</Label>
                        <span>{rotateX}°</span>
                      </div>
                      <input
                        id="rot-x"
                        type="range"
                        min="0"
                        max="360"
                        value={rotateX}
                        onChange={(e) => setRotateX(Number(e.target.value))}
                        className="w-full accent-accent bg-muted rounded-lg h-1"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <Label htmlFor="rot-y">Eixo Y</Label>
                        <span>{rotateY}°</span>
                      </div>
                      <input
                        id="rot-y"
                        type="range"
                        min="0"
                        max="360"
                        value={rotateY}
                        onChange={(e) => setRotateY(Number(e.target.value))}
                        disabled={inspectorRotate}
                        className="w-full accent-accent bg-muted rounded-lg h-1 disabled:opacity-30"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <Label htmlFor="rot-z">Eixo Z</Label>
                        <span>{rotateZ}°</span>
                      </div>
                      <input
                        id="rot-z"
                        type="range"
                        min="0"
                        max="360"
                        value={rotateZ}
                        onChange={(e) => setRotateZ(Number(e.target.value))}
                        className="w-full accent-accent bg-muted rounded-lg h-1"
                      />
                    </div>
                  </div>

                  {/* lighting settings */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block flex items-center gap-1">
                      <Sun size={12} className="text-accent" />
                      Iluminação
                    </span>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <Label htmlFor="light-dir">Luz Direcional</Label>
                        <span>{dirLightIntensity.toFixed(1)}</span>
                      </div>
                      <input
                        id="light-dir"
                        type="range"
                        min="0.1"
                        max="2"
                        step="0.1"
                        value={dirLightIntensity}
                        onChange={(e) => setDirLightIntensity(Number(e.target.value))}
                        className="w-full accent-accent bg-muted rounded-lg h-1"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <Label htmlFor="light-amb">Luz Ambiente</Label>
                        <span>{ambientLightIntensity.toFixed(1)}</span>
                      </div>
                      <input
                        id="light-amb"
                        type="range"
                        min="0.1"
                        max="2"
                        step="0.1"
                        value={ambientLightIntensity}
                        onChange={(e) => setAmbientLightIntensity(Number(e.target.value))}
                        className="w-full accent-accent bg-muted rounded-lg h-1"
                      />
                    </div>
                  </div>

                  {/* wireframe & rotate switches */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="rotate-toggle" className="cursor-pointer text-[11px] text-muted-foreground">Rotação Automática</Label>
                      <input 
                        id="rotate-toggle"
                        type="checkbox" 
                        checked={inspectorRotate}
                        onChange={(e) => setInspectorRotate(e.target.checked)}
                        className="rounded border-border text-accent focus:ring-accent h-4 w-4 cursor-pointer bg-surface"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-surface/60 border border-border rounded-lg text-[10px] space-y-1.5 text-muted-foreground">
                  <p className="font-semibold text-foreground flex items-center gap-1">
                    <Info size={12} className="text-accent" />
                    Interação de Tela
                  </p>
                  <p>Arrastar com botão esquerdo para girar.</p>
                  <p>Arrastar com botão direito para mover.</p>
                  <p>Scroll do mouse para aproximar/afastar.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
