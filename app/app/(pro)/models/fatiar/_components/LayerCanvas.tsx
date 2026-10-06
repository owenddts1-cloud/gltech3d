"use client";

/**
 * Preview da camada, em 2D.
 *
 * 2D e não 3D de propósito: o que se inspeciona numa camada é se a parede
 * fechou, se o preenchimento respeitou o furo e onde está o sólido. Em 3D, com
 * 800 camadas empilhadas, nada disso se vê. Aqui cada camada é uma planta baixa
 * legível, e o canvas 2D desenha centenas de milhares de segmentos sem WebGL.
 *
 * Cores seguem a convenção do G-code (`;TYPE:`): parede em laranja (o acento do
 * sistema), preenchimento em azul apagado, suporte e aderência em cinza.
 */

import { useEffect, useRef } from "react";

import type { Contour } from "@/lib/slicer/slice";
import type { InfillLine } from "@/lib/slicer/infill";

interface Props {
  outerWalls: Contour[];
  innerWalls: Contour[];
  infill: InfillLine[];
  supports: InfillLine[];
  skirt: Contour[];
  brim: Contour[];
  /** Caixa do modelo inteiro, para a escala não pular entre camadas. */
  bounds: { min: [number, number, number]; max: [number, number, number] };
  showInfill: boolean;
}

export function LayerCanvas({
  outerWalls,
  innerWalls,
  infill,
  supports,
  skirt,
  brim,
  bounds,
  showInfill,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const cssSize = canvas.clientWidth;
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize, cssSize);

    const width = bounds.max[0] - bounds.min[0];
    const depth = bounds.max[1] - bounds.min[1];
    const span = Math.max(width, depth, 1);
    // Folga maior que a caixa do modelo: skirt e brim ficam FORA da peça e
    // seriam cortados por uma escala calculada só sobre o modelo.
    const padding = 12;
    const margin = 1.12;
    const scale = (cssSize - padding * 2) / (span * margin);

    // Y do modelo cresce para o fundo; no canvas cresce para baixo. Inverter
    // aqui evita a peça aparecer espelhada em relação ao que a impressora faz.
    const cx = bounds.min[0] + width / 2;
    const cy = bounds.min[1] + depth / 2;
    const toX = (x: number) => cssSize / 2 + (x - cx) * scale;
    const toY = (y: number) => cssSize / 2 - (y - cy) * scale;

    const strokeLines = (lines: InfillLine[], style: string, lineWidth: number) => {
      if (lines.length === 0) return;
      ctx.strokeStyle = style;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (const line of lines) {
        ctx.moveTo(toX(line.from.x), toY(line.from.y));
        ctx.lineTo(toX(line.to.x), toY(line.to.y));
      }
      ctx.stroke();
    };

    const strokeLoops = (loops: Contour[], style: string, lineWidth: number) => {
      if (loops.length === 0) return;
      ctx.strokeStyle = style;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (const contour of loops) {
        if (contour.length < 2) continue;
        ctx.moveTo(toX(contour[0]!.x), toY(contour[0]!.y));
        for (let i = 1; i < contour.length; i++) {
          ctx.lineTo(toX(contour[i]!.x), toY(contour[i]!.y));
        }
        ctx.closePath();
      }
      ctx.stroke();
    };

    // Ordem de desenho = hierarquia de leitura. O que é descartado depois da
    // impressão (aderência, suporte) fica por baixo; a peça por cima.
    strokeLoops(skirt, "rgba(115, 115, 115, 0.65)", 1);
    strokeLoops(brim, "rgba(140, 140, 140, 0.8)", 1);
    if (showInfill) strokeLines(infill, "rgba(96, 165, 250, 0.55)", 1);
    strokeLines(supports, "rgba(163, 163, 163, 0.7)", 1);
    // Interna mais apagada e mais fina que a externa: é a distinção que o
    // emissor de G-code agora também faz (`;TYPE:WALL-INNER`).
    strokeLoops(innerWalls, "rgba(251, 146, 60, 0.45)", 1);
    strokeLoops(outerWalls, "#fb923c", 1.8);
  }, [outerWalls, innerWalls, infill, supports, skirt, brim, bounds, showInfill]);

  return (
    <canvas
      ref={canvasRef}
      className="aspect-square w-full rounded-lg border border-border bg-zinc-950"
      role="img"
      aria-label="Vista de cima da camada selecionada"
    />
  );
}
