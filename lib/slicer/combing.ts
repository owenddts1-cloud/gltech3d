/**
 * Combing: decidir se um salto em vazio precisa mesmo de retração.
 *
 * POR QUE ISTO EXISTE. A primeira versão da retração recolhia o filamento em
 * TODO salto acima do limite. Medi no Acoplamento: **24.271 retrações**, e a
 * estimativa subiu de 1h56 para 2h43 — 40% do tempo gasto recolhendo e
 * reprimindo filamento. A maioria eram saltos de uma linha de preenchimento
 * para a seguinte, a 2,7 mm uma da outra, POR DENTRO da peça.
 *
 * Retrair ali não serve para nada: o que a retração evita é o fio-de-teia, que
 * só acontece quando o bico atravessa o VAZIO. Passando por cima de material que
 * vai ser coberto pela próxima camada, o pingo some dentro da peça. Em troca, o
 * custo é real — cada ciclo desgasta o mesmo trecho de filamento e some com a
 * pressão, o que deixa o começo da linha seguinte fraco.
 *
 * O critério aqui é o mesmo dos fatiadores de verdade: só retrai se o salto
 * CRUZAR uma parede. Não cruzou, continuou dentro da mesma região — sem
 * retração.
 *
 * ESCRITO DO ZERO. Nada vem de CuraEngine, PrusaSlicer ou Slic3r.
 */

import type { Contour, Point2 } from "./slice";

/** Lado em que `p` cai em relação à reta `a→b`. Sinal do produto vetorial. */
function orientation(a: Point2, b: Point2, p: Point2): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

const EPS = 1e-9;

/**
 * Dois segmentos se cruzam de verdade?
 *
 * Só cruzamento PRÓPRIO: tocar a ponta ou correr em cima da parede não conta.
 * Isso é de propósito — o salto sai de um ponto que costuma estar exatamente
 * sobre um percurso, e tratar esse toque como cruzamento faria retrair sempre,
 * que é justamente o problema que este módulo resolve.
 */
export function segmentsCross(a1: Point2, a2: Point2, b1: Point2, b2: Point2): boolean {
  const d1 = orientation(b1, b2, a1);
  const d2 = orientation(b1, b2, a2);
  const d3 = orientation(a1, a2, b1);
  const d4 = orientation(a1, a2, b2);

  // Colinear ou encostando: não é travessia.
  if (Math.abs(d1) < EPS || Math.abs(d2) < EPS || Math.abs(d3) < EPS || Math.abs(d4) < EPS) {
    return false;
  }
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * O salto atravessa alguma parede da camada?
 *
 * Sem paredes conhecidas, devolve `true`: na dúvida, retrai. Errar para o lado
 * de retrair a mais custa tempo; errar para o lado de não retrair deixa a peça
 * cheia de fio.
 */
export function travelCrossesWall(from: Point2, to: Point2, walls: readonly Contour[]): boolean {
  if (walls.length === 0) return true;

  for (const contour of walls) {
    if (contour.length < 2) continue;
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i]!;
      const b = contour[(i + 1) % contour.length]!;
      if (segmentsCross(from, to, a, b)) return true;
    }
  }
  return false;
}
