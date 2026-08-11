/**
 * Costura: onde cada volta de parede começa e termina.
 *
 * Toda volta fechada tem um ponto onde o bico começa a extrudar e outro onde
 * para. Ali sobra material (o bico ainda escorre ao parar) e falta material (a
 * pressão ainda não subiu ao começar). Isso deixa uma cicatriz.
 *
 * Hoje o começo era `contour[0]`, que vem da ORDEM DA COSTURA DE SEGMENTOS — ou
 * seja, de onde o fatiamento por acaso encontrou o primeiro triângulo. Muda de
 * camada para camada sem critério, e a cicatriz fica espalhada pela peça inteira.
 *
 * Este módulo resolve as duas metades do problema:
 *  1. ESCOLHER o ponto de partida (`seamStartIndex`)
 *  2. SUAVIZAR a junção com um cachecol (`scarfPath`)
 *
 * ESCRITO DO ZERO. Nada vem de PrusaSlicer, CuraEngine, Slic3r ou OrcaSlicer.
 */

import type { Contour, Point2 } from "./slice";

export type SeamMode = "canto" | "alinhada" | "tras" | "proxima" | "aleatoria";

export const SEAM_MODES: Array<{ value: SeamMode; label: string; hint: string }> = [
  { value: "canto", label: "Canto mais agudo", hint: "esconde a marca no canto da peça" },
  { value: "alinhada", label: "Alinhada", hint: "uma linha reta só, fácil de lixar" },
  { value: "tras", label: "Atrás", hint: "no lado que não se vê na bancada" },
  { value: "proxima", label: "Mais próxima", hint: "menos deslocamento, marca espalhada" },
  { value: "aleatoria", label: "Aleatória", hint: "sem linha; vira textura" },
];

export interface SeamContext {
  /** Posição atual do bico. Usada por `proxima`. */
  cursor: Point2;
  /** Canto de referência da peça. Usado por `alinhada` e `tras`. */
  anchor: Point2;
  /**
   * Índice da camada. Usado por `aleatoria` — é a semente.
   *
   * DETERMINÍSTICO de propósito: `Math.random()` faria o mesmo STL com os mesmos
   * ajustes gerar G-code diferente a cada clique, e aí nenhum teste de regressão
   * de arquivo funciona. Aleatório aqui significa "espalhado", não "imprevisível".
   */
  layerIndex: number;
}

const dist2 = (a: Point2, b: Point2): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Índice do vértice mais próximo de um alvo. */
function nearestIndex(contour: Contour, target: Point2): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < contour.length; i++) {
    const d = dist2(contour[i]!, target);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/**
 * Vértice mais "fechado" do contorno — o canto onde a cicatriz some.
 *
 * Mede o cosseno do ângulo entre a aresta que chega e a que sai. Quanto mais
 * perto de +1, mais o caminho dobra sobre si mesmo, e mais fundo é o canto.
 * Aresta reta dá cosseno −1 e nunca ganha.
 *
 * Não distingo côncavo de convexo: precisaria da orientação do contorno, que
 * varia entre externo e furo, e na prática QUALQUER canto vivo esconde a marca
 * melhor que uma parede lisa. Canto raso demais (quase reto) é rejeitado pelo
 * limite, e aí cai no vértice mais próximo do canto de referência — não sai um
 * ponto arbitrário.
 */
const MIN_CORNER_COS = -0.5; // ~120° de abertura ou menos

export function sharpestCornerIndex(contour: Contour): number {
  if (contour.length < 3) return 0;

  let best = -1;
  let bestCos = MIN_CORNER_COS;
  for (let i = 0; i < contour.length; i++) {
    const prev = contour[(i - 1 + contour.length) % contour.length]!;
    const here = contour[i]!;
    const next = contour[(i + 1) % contour.length]!;

    const ax = prev.x - here.x;
    const ay = prev.y - here.y;
    const bx = next.x - here.x;
    const by = next.y - here.y;
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) continue;

    const cos = (ax * bx + ay * by) / (la * lb);
    if (cos > bestCos) {
      bestCos = cos;
      best = i;
    }
  }

  return best;
}

/** Onde a volta deve começar. */
export function seamStartIndex(contour: Contour, mode: SeamMode, ctx: SeamContext): number {
  if (contour.length < 2) return 0;

  switch (mode) {
    case "proxima":
      return nearestIndex(contour, ctx.cursor);

    case "aleatoria": {
      // Hash inteiro barato sobre camada + primeiro ponto: espalha entre camadas
      // sem depender de `Math.random`.
      const seed =
        (ctx.layerIndex * 2654435761 +
          Math.round(contour[0]!.x * 1000) * 40503 +
          Math.round(contour[0]!.y * 1000) * 12289) >>>
        0;
      return seed % contour.length;
    }

    case "tras": {
      // Só o Y importa: o objetivo é o lado de trás, não um canto específico.
      let best = 0;
      let bestY = -Infinity;
      for (let i = 0; i < contour.length; i++) {
        if (contour[i]!.y > bestY) {
          bestY = contour[i]!.y;
          best = i;
        }
      }
      return best;
    }

    case "canto": {
      const corner = sharpestCornerIndex(contour);
      // Sem canto vivo (peça redonda): cai no alinhado, que ao menos empilha a
      // marca numa linha só em vez de espalhar.
      return corner >= 0 ? corner : nearestIndex(contour, ctx.anchor);
    }

    case "alinhada":
    default:
      return nearestIndex(contour, ctx.anchor);
  }
}

/** Roda a volta fechada para começar em `index`. Preserva todos os pontos. */
export function rotateToStart(contour: Contour, index: number): Contour {
  if (contour.length < 2) return [...contour];
  const i = ((index % contour.length) + contour.length) % contour.length;
  if (i === 0) return [...contour];
  return [...contour.slice(i), ...contour.slice(0, i)];
}

/** Um passo do caminho, com a fração de vazão a aplicar até ele. */
export interface FlowStep {
  point: Point2;
  /** 0 a 1. Multiplica a extrusão do trecho que TERMINA neste ponto. */
  flow: number;
}

const lerp = (a: Point2, b: Point2, t: number): Point2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/**
 * Costura tipo cachecol (scarf joint): a emenda vira uma rampa sobreposta.
 *
 * Sem cachecol, a volta começa e termina secamente no mesmo ponto: no começo a
 * pressão ainda não subiu (falta material, fica um furinho) e no fim o bico
 * ainda escorre (sobra material, fica um calombo).
 *
 * Com cachecol, o caminho anda `scarfLengthMm` ALÉM do ponto inicial. Na entrada
 * a vazão sobe de 0 a 1; na saída — que passa por cima da entrada — desce de 1 a
 * 0. As duas cunhas se encaixam e fundem.
 *
 * A CONTA QUE IMPORTA: no trecho sobreposto, a entrada deposita `s/L` e a saída
 * `1 − s/L`. A soma é exatamente 1. Logo o material total é o MESMO de uma volta
 * sem cachecol — se não fosse, a parede sairia mais fina ou mais grossa que as
 * outras. É invariante testada, não suposição.
 *
 * Os trechos são partidos nos limites `s = L` e `s = P` (a volta completa). Como
 * a rampa é linear, usar o valor no PONTO MÉDIO do sub-trecho dá a média exata,
 * não uma aproximação.
 *
 * Só modulação de vazão — sem variar Z. A variante com Z inclinado deposita
 * melhor, mas depende de a mecânica acompanhar movimento em Z durante a extrusão,
 * e não tenho como verificar isso na sua máquina daqui.
 */
export function scarfPath(contour: Contour, scarfLengthMm: number): FlowStep[] {
  if (contour.length < 2) return contour.map((point) => ({ point, flow: 1 }));

  // Volta fechada: repete o primeiro ponto no fim.
  const loop: Point2[] = [...contour, contour[0]!];

  const perimeter = loop.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - loop[i - 1]!.x, p.y - loop[i - 1]!.y)),
    0,
  );

  // Cachecol maior que metade da volta se sobreporia a si mesmo em cima da
  // própria rampa de saída; e sem comprimento não há cachecol nenhum.
  const L = scarfLengthMm;
  if (!(L > 0) || perimeter <= 0 || L >= perimeter / 2) {
    return loop.slice(1).map((point) => ({ point, flow: 1 }));
  }

  /** Vazão acumulada até a distância `s` do início, integrada de 0 a s. */
  const flowAt = (s: number): number => {
    if (s < L) return s / L; // rampa de entrada
    if (s <= perimeter) return 1; // corpo da volta
    return Math.max(0, 1 - (s - perimeter) / L); // rampa de saída
  };

  const steps: FlowStep[] = [];
  let travelled = 0;
  let current = loop[0]!;
  let index = 1;
  const total = perimeter + L;

  // Pontos onde a rampa muda de regime e o trecho precisa ser partido.
  const breakpoints = [L, perimeter];

  while (travelled < total - 1e-12) {
    // `index` é sempre reposto para dentro do laço no fim da iteração, então
    // aqui ele é um vértice válido — inclusive na segunda volta, a do cachecol.
    const target = loop[index]!;
    const segmentLength = Math.hypot(target.x - current.x, target.y - current.y);

    if (segmentLength < 1e-12) {
      current = target;
      index = index + 1 >= loop.length ? 1 : index + 1;
      continue;
    }

    // Onde este trecho termina, considerando quebras e o fim do caminho.
    let end = Math.min(travelled + segmentLength, total);
    for (const bp of breakpoints) {
      if (bp > travelled + 1e-12 && bp < end) end = bp;
    }

    const t = (end - travelled) / segmentLength;
    const point = t >= 1 - 1e-12 ? target : lerp(current, target, t);
    // Rampa linear: o valor no meio do trecho É a média do trecho.
    steps.push({ point, flow: flowAt((travelled + end) / 2) });

    if (t >= 1 - 1e-12) {
      current = target;
      index++;
      if (index >= loop.length) index = 1; // dá a volta para a rampa de saída
    } else {
      current = point;
    }
    travelled = end;
  }

  return steps;
}
