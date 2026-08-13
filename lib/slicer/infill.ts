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
import { offsetRegion } from "./perimeters";

export type InfillPattern = "linhas" | "grade" | "triangulo" | "giroide" | "concentrico";

export interface InfillOptions {
  /** 0 = oco, 100 = sólido. */
  densityPct: number;
  /** Largura da linha extrudada, em mm. Normalmente ≈ diâmetro do bico. */
  lineWidth: number;
  pattern: InfillPattern;
  /** Giro do padrão, em graus. Alternar por camada aumenta a resistência. */
  angleDeg: number;
  /**
   * Altura Z desta camada, em mm.
   *
   * Só o giroide usa: ele é uma superfície 3D, e o desenho da camada depende de
   * ONDE ela corta essa superfície. Os outros padrões são 2D e ignoram.
   */
  zMm?: number;
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

/** Está no material? Regra par-ímpar, a mesma que classifica furo. */
function insideMaterial(p: Point2, contours: readonly Contour[]): boolean {
  let depth = 0;
  for (const c of contours) if (pointInContour(p, c)) depth++;
  return depth % 2 === 1;
}

/**
 * Achata os contornos num `Float64Array` de 8 números por aresta:
 * `ax, ay, dx, dy, minX, maxX, minY, maxY`.
 *
 * Achatar existe pelo mesmo motivo do descarte por caixa: o recorte percorre
 * esta lista milhares de vezes por camada, e um array de objetos faria o
 * coletor de lixo trabalhar em cima de dados que nunca mudam.
 */
function arestasComCaixa(contours: readonly Contour[]): Float64Array {
  let total = 0;
  for (const c of contours) total += c.length;

  const out = new Float64Array(total * 8);
  let at = 0;
  for (const c of contours) {
    for (let j = 0; j < c.length; j++) {
      const a = c[j]!;
      const b = c[(j + 1) % c.length]!;
      out[at] = a.x;
      out[at + 1] = a.y;
      out[at + 2] = b.x - a.x;
      out[at + 3] = b.y - a.y;
      out[at + 4] = Math.min(a.x, b.x);
      out[at + 5] = Math.max(a.x, b.x);
      out[at + 6] = Math.min(a.y, b.y);
      out[at + 7] = Math.max(a.y, b.y);
      at += 8;
    }
  }
  return out;
}

/**
 * Recorta uma polilinha contra a região, cortando NAS ARESTAS.
 *
 * Amostrar e jogar fora o que cai fora deixaria a borda serrilhada, com o
 * preenchimento parando antes da parede ou passando dela. Aqui cada trecho é
 * partido exatamente onde cruza o contorno, e só os pedaços de dentro sobrevivem.
 */
function clipPolyline(
  poly: readonly Point2[],
  contours: readonly Contour[],
  arestas: Float64Array,
): InfillLine[] {
  const out: InfillLine[] = [];

  for (let i = 0; i + 1 < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[i + 1]!;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) continue;

    const sMinX = Math.min(p.x, q.x);
    const sMaxX = Math.max(p.x, q.x);
    const sMinY = Math.min(p.y, q.y);
    const sMaxY = Math.max(p.y, q.y);

    // Onde este trecho cruza o contorno.
    const cortes: number[] = [0, 1];
    for (let j = 0; j < arestas.length; j += 8) {
      // DESCARTE POR CAIXA, antes da conta. Um trecho de 0,4 mm não pode cruzar
      // uma aresta que está a 30 mm dali, e testar mesmo assim era o grosso do
      // custo: o giroide gastava 3× o tempo da grade só nesta comparação.
      if (
        arestas[j + 4]! > sMaxX ||
        arestas[j + 5]! < sMinX ||
        arestas[j + 6]! > sMaxY ||
        arestas[j + 7]! < sMinY
      ) {
        continue;
      }

      const ax = arestas[j]!;
      const ay = arestas[j + 1]!;
      const ex = arestas[j + 2]!;
      const ey = arestas[j + 3]!;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < EPS) continue; // paralelos
      const t = ((ax - p.x) * ey - (ay - p.y) * ex) / den;
      const u = ((ax - p.x) * dy - (ay - p.y) * dx) / den;
      if (t > EPS && t < 1 - EPS && u >= 0 && u <= 1) cortes.push(t);
    }

    cortes.sort((m, n) => m - n);

    for (let k = 0; k + 1 < cortes.length; k++) {
      const t0 = cortes[k]!;
      const t1 = cortes[k + 1]!;
      if (t1 - t0 < EPS) continue;
      const meio = t0 + (t1 - t0) / 2;
      if (!insideMaterial({ x: p.x + dx * meio, y: p.y + dy * meio }, contours)) continue;
      out.push({
        from: { x: p.x + dx * t0, y: p.y + dy * t0 },
        to: { x: p.x + dx * t1, y: p.y + dy * t1 },
      });
    }
  }

  return out;
}

/**
 * Giroide — a superfície triplamente periódica `sin x·cos y + sin y·cos z +
 * sin z·cos x = 0`.
 *
 * POR QUE ELE VALE A PENA. É quase isotrópico: resiste parecido nos três eixos,
 * ao contrário da grade, que é forte em dois e fraca no terceiro. E as curvas de
 * camadas vizinhas nunca se cruzam no mesmo ponto, então o bico não bate no que
 * já foi depositado — o barulho e o solavanco de grade densa somem.
 *
 * COMO A CAMADA É RESOLVIDA. Com `z` fixo, a equação vira `A·cos y + B·sen y = C`
 * com `A = sen x`, `B = cos z`, `C = −sen z·cos x`. Isso é `R·cos(y − φ) = C`,
 * com `R = hypot(A, B)` e `φ = atan2(B, A)` — ou seja, `y = φ ± acos(C/R)`,
 * repetido a cada `2π`. Quando `|C| > R` não existe solução naquele `x`: a
 * curva simplesmente não passa ali, e a polilinha é cortada.
 *
 * Matemática pública. Nenhuma linha vem de fatiador AGPL.
 */
function gyroidFill(
  contours: Contour[],
  spacing: number,
  zMm: number,
  angleDeg: number,
): InfillLine[] {
  const pts = contours.flat();
  if (pts.length === 0) return [];

  const rad = (angleDeg * Math.PI) / 180;
  const cosI = Math.cos(-rad);
  const sinI = Math.sin(-rad);
  const cosB = Math.cos(rad);
  const sinB = Math.sin(rad);

  const girados = contours.map((c) => c.map((p) => rotate(p, cosI, sinI)));
  // Uma vez só para a camada inteira: são dezenas de polilinhas recortadas
  // contra o MESMO contorno, e refazer a lista em cada uma era desperdício puro.
  const arestas = arestasComCaixa(girados);
  const rp = girados.flat();
  const minX = Math.min(...rp.map((p) => p.x));
  const maxX = Math.max(...rp.map((p) => p.x));
  const minY = Math.min(...rp.map((p) => p.y));
  const maxY = Math.max(...rp.map((p) => p.y));

  // Curvas vizinhas ficam a ~π em unidades normalizadas. Amarrar π ao
  // espaçamento pedido é o que faz a densidade bater com a dos outros padrões.
  const k = Math.PI / spacing;
  const zn = zMm * k;
  const B = Math.cos(zn);
  const senZ = Math.sin(zn);

  // Passo fino o bastante para a curva não virar polígono visível, mas não tão
  // fino que exploda a contagem de segmentos numa peça grande.
  const passo = Math.max(spacing / 6, 0.05);

  const mMin = Math.floor((minY * k) / (2 * Math.PI)) - 1;
  const mMax = Math.ceil((maxY * k) / (2 * Math.PI)) + 1;

  const lines: InfillLine[] = [];

  for (const sinal of [1, -1]) {
    for (let m = mMin; m <= mMax; m++) {
      let poly: Point2[] = [];

      const fechar = () => {
        if (poly.length >= 2) {
          for (const l of clipPolyline(poly, girados, arestas)) {
            lines.push({
              from: rotate(l.from, cosB, sinB),
              to: rotate(l.to, cosB, sinB),
            });
          }
        }
        poly = [];
      };

      for (let x = minX; x <= maxX + passo; x += passo) {
        const xn = x * k;
        const A = Math.sin(xn);
        const C = -senZ * Math.cos(xn);
        const R = Math.hypot(A, B);

        // Sem solução aqui: a curva não passa neste x. Quebra a polilinha em vez
        // de ligar dois ramos que não se tocam.
        if (R < EPS || Math.abs(C) > R) {
          fechar();
          continue;
        }

        const y = (Math.atan2(B, A) + sinal * Math.acos(C / R) + 2 * Math.PI * m) / k;
        if (y < minY - spacing || y > maxY + spacing) {
          fechar();
          continue;
        }

        poly.push({ x, y });
      }

      fechar();
    }
  }

  return lines;
}

/**
 * Concêntrico — laços paralelos ao contorno, para dentro.
 *
 * É o padrão que segue a forma da peça em vez de cortá-la em diagonal. Bom para
 * peça de parede fina e para quem quer o preenchimento acompanhando a silhueta.
 * Sai barato: é `offsetRegion` repetido, e o motor de offset já existe.
 */
function concentricFill(contours: Contour[], spacing: number): InfillLine[] {
  const lines: InfillLine[] = [];
  let atual = offsetRegion(contours, -spacing / 2);

  // Teto duro de voltas: um offset que não converge (região degenerada) faria
  // laço infinito dentro do worker, com a aba travada e sem mensagem de erro.
  for (let volta = 0; volta < 500 && atual.length > 0; volta++) {
    for (const c of atual) {
      for (let i = 0; i < c.length; i++) {
        const a = c[i]!;
        const b = c[(i + 1) % c.length]!;
        if (Math.hypot(b.x - a.x, b.y - a.y) < EPS) continue;
        lines.push({ from: a, to: b });
      }
    }
    atual = offsetRegion(atual, -spacing);
  }

  return lines;
}

/** Preenchimento de uma camada. */
export function generateInfill(contours: Contour[], options: InfillOptions): InfillLine[] {
  const spacing = infillSpacing(options.densityPct, options.lineWidth);
  if (!Number.isFinite(spacing)) return []; // densidade 0 = peça oca

  switch (options.pattern) {
    case "giroide":
      return gyroidFill(contours, spacing, options.zMm ?? 0, options.angleDeg);
    case "concentrico":
      return concentricFill(contours, spacing);
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
