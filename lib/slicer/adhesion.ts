/**
 * Aderência: skirt e brim. Os laços extras da primeira camada.
 *
 * SKIRT — um ou mais laços a uma distância da peça, sem encostar nela. Não
 * segura nada: serve para o bico estabilizar o fluxo antes da primeira linha que
 * conta. Sem ele, a primeira parede da peça sai com falha, porque a pressão
 * dentro do bico ainda está subindo.
 *
 * BRIM — laços colados na peça, expandindo para fora. Aumentam a área grudada na
 * mesa. É o que impede peça de base pequena de soltar no meio da impressão.
 *
 * Os dois são o ESPELHO de `generatePerimeters`: aquele anda para dentro do
 * contorno, estes andam para fora. A geometria difícil (remover auto-interseção
 * ao deslocar) já está resolvida em `offsetRegion`.
 *
 * ESCRITO DO ZERO. Nada vem de CuraEngine, PrusaSlicer ou Slic3r.
 */

import { classifyHoles, type Contour } from "./slice";
import { offsetRegion, unionRegions } from "./perimeters";

/**
 * Descarta os furos, ficando só com os contornos externos.
 *
 * Deslocar para FORA uma região com furo empurra a borda do furo para DENTRO
 * dele — ou seja, geraria brim dentro do furo. No Acoplamento, que é um tubo,
 * isso encheria o furo central de laços impossíveis de remover sem estragar a
 * peça. Skirt dentro de um furo é igualmente inútil.
 *
 * CONTRATO: a entrada vem de `sliceMesh`, onde os contornos de uma camada são
 * disjuntos ou propriamente aninhados. `classifyHoles` decide por aninhamento,
 * então contornos que se SOBREPÕEM sem se aninhar (só possível em malha
 * auto-intersectante) fazem o de dentro ser lido como furo e sumir. O efeito
 * seria uma ilha sem skirt — cosmético. Coberto por teste, para não virar
 * caça-fantasma depois.
 */
export function outerOnly(contours: readonly Contour[]): Contour[] {
  if (contours.length === 0) return [];
  return classifyHoles([...contours])
    .filter((c) => !c.isHole)
    .map((c) => c.contour);
}

/** Silhueta da primeira camada: o que toca a mesa, sem os furos. */
export function footprintOf(contours: readonly Contour[]): Contour[] {
  const outer = outerOnly(contours);
  if (outer.length === 0) return [];
  // União: ilhas encostadas viram uma silhueta só, e sobreposição vira material
  // em vez de se cancelar.
  return unionRegions(outer, []);
}

export interface SkirtOptions {
  /** Quantos laços. 1 costuma bastar para preparar o fluxo. */
  loops: number;
  /** Distância entre a peça e o laço mais interno, em mm. */
  gapMm: number;
  lineWidth: number;
}

/**
 * Laços do skirt, do mais interno para o mais externo.
 *
 * O primeiro fica a `gap + lineWidth/2` do contorno: `gap` é a folga que se quer
 * ver, e a meia largura põe a BORDA do filete a exatamente `gap` da peça — o
 * caminho é o centro do filete, não a borda.
 *
 * LIMITAÇÃO DECLARADA: o skirt segue o contorno deslocado, não o casco convexo.
 * Duas ilhas afastadas mais que `2 × gap` geram um laço cada uma em vez de um
 * laço só envolvendo as duas. Para preparar o fluxo tanto faz; se um dia o skirt
 * virar barreira contra corrente de ar, aí o casco convexo passa a importar.
 */
export function generateSkirt(footprint: readonly Contour[], options: SkirtOptions): Contour[] {
  const { loops, gapMm, lineWidth } = options;
  if (footprint.length === 0 || loops < 1 || !(lineWidth > 0) || gapMm < 0) return [];

  const out: Contour[] = [];
  for (let i = 0; i < loops; i++) {
    const ring = offsetRegion(footprint, gapMm + lineWidth * (0.5 + i));
    if (ring.length === 0) break;
    out.push(...ring);
  }
  return out;
}

export interface BrimOptions {
  /** Largura total do brim, em mm. Vira `ceil(width / lineWidth)` laços. */
  widthMm: number;
  lineWidth: number;
}

/**
 * Laços do brim, do mais EXTERNO para o mais interno.
 *
 * A ordem não é estética: terminando no laço colado à peça, o bico já está no
 * lugar certo para começar a parede, sem um deslocamento em vazio atravessando o
 * brim recém-depositado.
 *
 * O primeiro laço colado fica a `lineWidth/2` para fora do contorno — a mesma
 * conta da parede externa, que fica a `lineWidth/2` para dentro. Assim as bordas
 * dos dois filetes se encostam exatamente sobre a superfície do modelo, sem vão
 * e sem sobreposição.
 */
export function generateBrim(footprint: readonly Contour[], options: BrimOptions): Contour[] {
  const { widthMm, lineWidth } = options;
  if (footprint.length === 0 || !(widthMm > 0) || !(lineWidth > 0)) return [];

  const loops = Math.ceil(widthMm / lineWidth);
  const rings: Contour[][] = [];
  for (let i = 0; i < loops; i++) {
    const ring = offsetRegion(footprint, lineWidth * (0.5 + i));
    if (ring.length === 0) break;
    rings.push(ring);
  }

  return rings.reverse().flat();
}
