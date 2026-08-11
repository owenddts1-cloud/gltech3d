/**
 * Preenchimento (infill) por varredura.
 *
 * POR QUE VARREDURA E NÃO OFFSET DE POLÍGONO: gerar preenchimento recortando
 * linhas contra o contorno só precisa de interseção reta×aresta e da regra
 * par-ímpar — matemática simples e robusta. A alternativa (offsets sucessivos)
 * exige um motor de offset de polígono com remoção de auto-interseção, que é
 * justamente a parte difícil e o motivo de o `clipper2` existir.
 *
 * Consequência honesta: isto entrega preenchimento correto **sem** perímetro
 * compensado pela largura do bico. Ver `docs/specs/modelagem-3d.md`.
 *
 * Escrito do zero. Nada vem de fatiador AGPL.
 */

import type { Contour, Point2 } from "./slice";
import { pointInContour } from "./slice";

export type InfillPattern = "linhas" | "grade" | "triangulo";

export interface InfillOptions {
  /** 0 = oco, 100 = sólido. */
  densityPct: number;
  /** Largura da linha extrudada, em mm. Normalmente ≈ diâmetro do bico. */
  lineWidth: number;
  pattern: InfillPattern;
  /** Giro do padrão, em graus. Alternar por camada aumenta a resistência. */
  angleDeg: number;
}

export interface InfillLine {
  from: Point2;
  to: Point2;
}

const EPS = 1e-9;

/** Espaçamento entre linhas para a densidade pedida. */
export function infillSpacing(densityPct: number, lineWidth: number): number {
  const density = Math.min(Math.max(densityPct, 0), 100);
  if (density <= 0) return Infinity;
  return (lineWidth * 100) / density;
}

function rotate(p: Point2, cos: number, sin: number): Point2 {
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/**
 * Linhas de um único ângulo, recortadas contra a região.
 *
 * A região é o conjunto de contornos da camada — externos e furos. Um ponto está
 * no material quando a contagem de contornos que o contêm é ÍMPAR; é a mesma
 * regra par-ímpar que classifica furo, e é o que faz o preenchimento respeitar
 * cavidade aninhada sem tratamento especial.
 */
function scanlineFill(
  contours: Contour[],
  spacing: number,
  angleDeg: number,
): InfillLine[] {
  if (!Number.isFinite(spacing) || spacing <= 0) return [];
  const all = contours.flat();
  if (all.length === 0) return [];

  const rad = (angleDeg * Math.PI) / 180;
  // Gira o mundo pelo ângulo NEGATIVO, varre na horizontal, e desgira o
  // resultado. Mais simples e menos sujeito a erro que varrer na diagonal.
  const cosI = Math.cos(-rad);
  const sinI = Math.sin(-rad);
  const cosB = Math.cos(rad);
  const sinB = Math.sin(rad);

  const rotated = contours.map((c) => c.map((p) => rotate(p, cosI, sinI)));
  const pts = rotated.flat();
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));

  const lines: InfillLine[] = [];
  // Começa meio espaçamento acima do mínimo: uma linha exatamente sobre a
  // aresta inferior produziria interseções degeneradas.
  for (let y = minY + spacing / 2; y < maxY; y += spacing) {
    const crossings: number[] = [];

    for (const contour of rotated) {
      for (let i = 0; i < contour.length; i++) {
        const a = contour[i]!;
        const b = contour[(i + 1) % contour.length]!;
        // Aresta horizontal não cruza. A comparação assimétrica (um `>` e um
        // `<=`) conta o vértice compartilhado UMA vez só — sem isso, uma linha
        // passando por um vértice conta duas e inverte dentro/fora.
        if (a.y > y !== b.y > y) {
          const t = (y - a.y) / (b.y - a.y);
          crossings.push(a.x + t * (b.x - a.x));
        }
      }
    }

    if (crossings.length < 2) continue;
    crossings.sort((p, q) => p - q);

    // Par a par: entre o 1º e o 2º há material, entre o 2º e o 3º não, etc.
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const x0 = crossings[i]!;
      const x1 = crossings[i + 1]!;
      if (x1 - x0 < EPS) continue;
      lines.push({
        from: rotate({ x: x0, y }, cosB, sinB),
        to: rotate({ x: x1, y }, cosB, sinB),
      });
    }
  }

  return lines;
}

/** Preenchimento de uma camada. */
export function generateInfill(contours: Contour[], options: InfillOptions): InfillLine[] {
  const spacing = infillSpacing(options.densityPct, options.lineWidth);
  if (!Number.isFinite(spacing)) return []; // densidade 0 = peça oca

  switch (options.pattern) {
    case "linhas":
      return scanlineFill(contours, spacing, options.angleDeg);
    case "grade":
      // Duas passadas cruzadas: cada uma com o dobro do espaçamento, para a
      // densidade final bater com a pedida.
      return [
        ...scanlineFill(contours, spacing * 2, options.angleDeg),
        ...scanlineFill(contours, spacing * 2, options.angleDeg + 90),
      ];
    case "triangulo":
      return [
        ...scanlineFill(contours, spacing * 3, options.angleDeg),
        ...scanlineFill(contours, spacing * 3, options.angleDeg + 60),
        ...scanlineFill(contours, spacing * 3, options.angleDeg + 120),
      ];
  }
}

/** Comprimento total extrudado, em mm. Base da estimativa de filamento. */
export function totalInfillLength(lines: InfillLine[]): number {
  return lines.reduce((sum, l) => sum + Math.hypot(l.to.x - l.from.x, l.to.y - l.from.y), 0);
}

/** Verificação de sanidade: o ponto médio de toda linha cai no material? */
export function linesAreInsideMaterial(lines: InfillLine[], contours: Contour[]): boolean {
  return lines.every((line) => {
    const mid = { x: (line.from.x + line.to.x) / 2, y: (line.from.y + line.to.y) / 2 };
    const depth = contours.filter((c) => pointInContour(mid, c)).length;
    return depth % 2 === 1;
  });
}
