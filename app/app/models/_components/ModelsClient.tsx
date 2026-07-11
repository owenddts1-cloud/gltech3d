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
  Gear
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

// Lazy-load ThreeViewer to keep initial page bundle small and prevent SSR errors
const ThreeViewer = dynamicImport(() => import("./ThreeViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex flex-col items-center justify-center bg-zinc-950/40 border border-zinc-800/40 rounded-lg">
      <ArrowsClockwise className="h-8 w-8 text-orange-500 animate-spin mb-2" />
      <p className="text-xs text-zinc-400">Carregando renderizador WebGL/Three.js...</p>
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
  positions: Float32Array;
  volumeCm3: number;
  uploadedAt: string;
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
        "relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-5 shadow-lg backdrop-blur-md transition-all duration-300",
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

export function ModelsClient() {
  const [models, setModels] = useState<StlModel[]>([]);
  const [activeInspector, setActiveInspector] = useState<StlModel | null>(null);
  const [inspectorColor, setInspectorColor] = useState("#3b82f6");
  const [inspectorWireframe, setInspectorWireframe] = useState(false);
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

  // Initialize demo STL files if list is empty
  const loadDemoModels = () => {
    // Generate synthetic vertex data for demo (e.g. a simple cylinder/pyramid/cone shape)
    const generateDemoPyramid = (width: number, height: number): Float32Array => {
      const vertices = [
        // Base (two triangles)
        -width/2, 0, -width/2,  width/2, 0, -width/2,   width/2, 0, width/2,
        -width/2, 0, -width/2,  width/2, 0, width/2,    -width/2, 0, width/2,
        // Sides (four triangles to apex)
        -width/2, 0, -width/2,  0, height, 0,           width/2, 0, -width/2,
        width/2, 0, -width/2,   0, height, 0,           width/2, 0, width/2,
        width/2, 0, width/2,    0, height, 0,           -width/2, 0, width/2,
        -width/2, 0, width/2,   0, height, 0,           -width/2, 0, -width/2
      ];
      return new Float32Array(vertices);
    };

    const noseConeVertices = generateDemoPyramid(40, 80);
    const bodyShellVertices = generateDemoPyramid(45, 120);

    const demo1: StlModel = {
      id: "demo_1",
      name: "GL_Rocket_NoseCone_v3.stl",
      sizeKb: 254,
      triangles: 6,
      boundingBox: { min: [-20, 0, -20], max: [20, 80, 20] },
      thumbnailUrl: drawStlThumbnail(noseConeVertices, [-20, 0, -20], [20, 80, 20]),
      positions: noseConeVertices,
      volumeCm3: 42.6,
      uploadedAt: new Date().toISOString()
    };

    const demo2: StlModel = {
      id: "demo_2",
      name: "GL_Rocket_BodyShell.stl",
      sizeKb: 512,
      triangles: 6,
      boundingBox: { min: [-22.5, 0, -22.5], max: [22.5, 120, 22.5] },
      thumbnailUrl: drawStlThumbnail(bodyShellVertices, [-22.5, 0, -22.5], [22.5, 120, 22.5]),
      positions: bodyShellVertices,
      volumeCm3: 81.2,
      uploadedAt: new Date().toISOString()
    };

    setModels([demo1, demo2]);
    toast.success("Modelos demonstrativos de foguete carregados!");
  };

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

  // Handle STL file selection and spawn background worker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".stl")) {
      toast.error("Por favor, envie apenas arquivos no formato STL.");
      return;
    }

    setIsParsing(true);
    const reader = new FileReader();

    reader.onload = function (event) {
      const arrayBuffer = event.target?.result as ArrayBuffer;

      // Spawn Web Worker for non-blocking binary parsing
      const worker = new Worker("/workers/stl-parser.js");
      worker.postMessage({ arrayBuffer });

      worker.onmessage = function (eMessage) {
        setIsParsing(false);
        const data = eMessage.data;

        if (!data.ok) {
          toast.error(`Erro ao analisar STL: ${data.error}`);
          worker.terminate();
          return;
        }

        const positions = new Float32Array(data.positions);
        const boundingBox = data.boundingBox;

        // Calculate approximate volume (cubic volume approximation)
        const dx = boundingBox.max[0] - boundingBox.min[0];
        const dy = boundingBox.max[1] - boundingBox.min[1];
        const dz = boundingBox.max[2] - boundingBox.min[2];
        const volumeCm3 = parseFloat(((dx * dy * dz * 0.5) / 1000).toFixed(1)); // mock voxel density

        const thumbnailUrl = drawStlThumbnail(positions, boundingBox.min, boundingBox.max);

        const newModel: StlModel = {
          id: "stl_" + Math.random().toString(36).substr(2, 9),
          name: file.name,
          sizeKb: Math.round(file.size / 1024),
          triangles: data.numTriangles,
          boundingBox,
          thumbnailUrl,
          positions,
          volumeCm3,
          uploadedAt: new Date().toISOString()
        };

        setModels((prev) => [newModel, ...prev]);
        toast.success(`Modelo "${file.name}" carregado e processado via Worker!`);
        worker.terminate();
      };
    };

    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeModel = (id: string) => {
    setModels(models.filter((m) => m.id !== id));
    if (activeInspector?.id === id) setActiveInspector(null);
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Cube className="text-orange-500" />
            Repositório de Modelos 3D
          </h1>
          <p className="text-sm text-zinc-400">
            Envie arquivos STL. Eles são processados em segundo plano via Web Worker para evitar travamento da tela.
          </p>
        </div>
        <div className="flex gap-2">
          {models.length === 0 && (
            <Button onClick={loadDemoModels} variant="outline" className="gap-2 border-zinc-800 hover:bg-zinc-900">
              <ArrowsClockwise className="h-4 w-4" />
              Carregar Modelos Demo
            </Button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".stl"
            className="hidden"
            id="stl-upload-input"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isParsing}
            className="gap-2 bg-orange-600 hover:bg-orange-700 text-white font-medium"
          >
            <Plus className="h-4 w-4" />
            {isParsing ? "Analisando STL..." : "Adicionar Arquivo STL"}
          </Button>
        </div>
      </header>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map((model) => (
          <SpotlightCard key={model.id} className="overflow-hidden border border-zinc-800/60 bg-zinc-950/40 hover:border-zinc-700/80 transition-all flex flex-col justify-between p-0 rounded-2xl">
            {/* Thumbnail Canvas render */}
            <div className="relative aspect-video w-full border-b border-zinc-800/40">
              <img
                src={model.thumbnailUrl}
                alt={model.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="bg-zinc-950/80 text-zinc-300 border border-zinc-800/80 text-[10px]">
                  {model.sizeKb} KB
                </Badge>
              </div>
            </div>

            {/* Model Description */}
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-sm text-zinc-150 truncate" title={model.name}>
                  {model.name}
                </h3>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Triângulos: {model.triangles.toLocaleString()} | Volume aproximado: {model.volumeCm3} cm³
                </p>
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-800/40">
                <Button 
                  onClick={() => {
                    setSliceHeightPercent(100);
                    setRotateX(0);
                    setRotateY(0);
                    setRotateZ(0);
                    setActiveInspector(model);
                  }}
                  className="flex-1 text-xs gap-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-xl"
                >
                  <Eye size={14} />
                  Inspecionar 3D
                </Button>
                <Button
                  onClick={() => removeModel(model.id)}
                  variant="outline"
                  className="p-2 border-red-500/20 hover:bg-red-500/10 text-red-400 rounded-xl"
                >
                  <Trash size={14} />
                </Button>
              </div>
            </div>
          </SpotlightCard>
        ))}

        {models.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed border-zinc-800 rounded-2xl text-center bg-zinc-950/20">
            <Cube className="h-12 w-12 text-zinc-500 mb-3" />
            <h3 className="font-semibold text-zinc-300">Nenhum arquivo 3D enviado</h3>
            <p className="text-xs text-zinc-400 max-w-sm mt-1">
              Faça o upload de arquivos STL para visualizar sua geometria em 3D de alta performance ou clique em Carregar Modelos Demo.
            </p>
          </div>
        )}
      </div>

      {/* 3D Inspector Modal (Lazy-Loaded Three.js Viewport) */}
      {activeInspector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <Card className="max-w-5xl w-full p-6 space-y-4 bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col h-[90vh] rounded-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800/60">
              <div>
                <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                  <Sparkles className="text-orange-500 h-5 w-5" />
                  {activeInspector.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Dimensões máximas: {
                    (activeInspector.boundingBox.max[0] - activeInspector.boundingBox.min[0]).toFixed(1)
                  }x{
                    (activeInspector.boundingBox.max[1] - activeInspector.boundingBox.min[1]).toFixed(1)
                  }x{
                    (activeInspector.boundingBox.max[2] - activeInspector.boundingBox.min[2]).toFixed(1)
                  } mm
                </p>
              </div>
              <Button variant="ghost" className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900" onClick={() => setActiveInspector(null)}>Fechar Visualizador</Button>
            </div>

            {/* Visualizer and settings container */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 overflow-hidden">
              {/* WebGL Canvas viewport */}
              <div className="md:col-span-3 h-full relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950/20 shadow-inner">
                <ThreeViewer
                  positions={activeInspector.positions}
                  boundingBox={activeInspector.boundingBox}
                  color={inspectorColor}
                  wireframe={inspectorWireframe}
                  autoRotate={inspectorRotate}
                  sliceHeightPercent={sliceHeightPercent}
                  dirLightIntensity={dirLightIntensity}
                  ambientLightIntensity={ambientLightIntensity}
                  rotateX={rotateX}
                  rotateY={rotateY}
                  rotateZ={rotateZ}
                />
              </div>

              {/* Viewport Config panel */}
              <div className="p-4 bg-zinc-900/30 border border-zinc-800/80 rounded-xl space-y-5 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-200 flex items-center gap-1.5 border-b border-zinc-800/60 pb-2">
                    <Gear className="text-orange-500" />
                    Controles e Fatiamento
                  </h4>

                  {/* Slicing Simulator Z */}
                  <div className="space-y-1.5">
                    <Label htmlFor="slice-range" className="text-[11px] text-zinc-300 font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Layers size={13} className="text-orange-500" />
                        Fatiar Altura (Z)
                      </span>
                      <span className="text-orange-400 font-bold">{sliceHeightPercent}%</span>
                    </Label>
                    <input
                      id="slice-range"
                      type="range"
                      min="0"
                      max="100"
                      value={sliceHeightPercent}
                      onChange={(e) => setSliceHeightPercent(Number(e.target.value))}
                      className="w-full accent-orange-500 bg-zinc-800 rounded-lg cursor-pointer h-1.5"
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <Label htmlFor="color-picker-select">Cor do Material</Label>
                    <select
                      id="color-picker-select"
                      value={inspectorColor}
                      onChange={(e) => setInspectorColor(e.target.value)}
                      className="w-full text-xs p-2 rounded-md border border-zinc-800 bg-zinc-950 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    >
                      <option value="#3b82f6" className="bg-zinc-950">Azul Elétrico</option>
                      <option value="#10b981" className="bg-zinc-950">Verde Esmeralda</option>
                      <option value="#ef4444" className="bg-zinc-950">Vermelho Rocket</option>
                      <option value="#f59e0b" className="bg-zinc-950">Âmbar Gold</option>
                      <option value="#d946ef" className="bg-zinc-950">Magenta Shock</option>
                      <option value="#64748b" className="bg-zinc-950">Cinza Titânio</option>
                    </select>
                  </div>

                  {/* manual rotation controls */}
                  <div className="space-y-3 pt-2 border-t border-zinc-800/40">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold block flex items-center gap-1">
                      <RotateCw size={11} className="text-orange-500" />
                      Orientação Manual
                    </span>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-300">
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
                        className="w-full accent-zinc-400 bg-zinc-800 rounded-lg h-1"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-300">
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
                        className="w-full accent-zinc-400 bg-zinc-800 rounded-lg h-1 disabled:opacity-30"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-300">
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
                        className="w-full accent-zinc-400 bg-zinc-800 rounded-lg h-1"
                      />
                    </div>
                  </div>

                  {/* lighting settings */}
                  <div className="space-y-3 pt-2 border-t border-zinc-800/40">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold block flex items-center gap-1">
                      <Sun size={12} className="text-orange-500" />
                      Iluminação
                    </span>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-300">
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
                        className="w-full accent-zinc-400 bg-zinc-800 rounded-lg h-1"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-300">
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
                        className="w-full accent-zinc-400 bg-zinc-800 rounded-lg h-1"
                      />
                    </div>
                  </div>

                  {/* wireframe & rotate switches */}
                  <div className="space-y-3 pt-2 border-t border-zinc-800/40">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="wireframe-toggle" className="cursor-pointer text-[11px] text-zinc-300">Modo Wireframe</Label>
                      <input 
                        id="wireframe-toggle"
                        type="checkbox" 
                        checked={inspectorWireframe}
                        onChange={(e) => setInspectorWireframe(e.target.checked)}
                        className="rounded border-zinc-800 text-orange-500 focus:ring-orange-500 h-4 w-4 cursor-pointer bg-zinc-950"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="rotate-toggle" className="cursor-pointer text-[11px] text-zinc-300">Rotação Automática</Label>
                      <input 
                        id="rotate-toggle"
                        type="checkbox" 
                        checked={inspectorRotate}
                        onChange={(e) => setInspectorRotate(e.target.checked)}
                        className="rounded border-zinc-800 text-orange-500 focus:ring-orange-500 h-4 w-4 cursor-pointer bg-zinc-950"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-zinc-950/40 border border-zinc-800/80 rounded-lg text-[10px] space-y-1.5 text-zinc-400">
                  <p className="font-semibold text-zinc-200 flex items-center gap-1">
                    <Info size={12} className="text-orange-500" />
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
