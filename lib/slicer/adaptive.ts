/**
 * Altura de camada variável.
 *
 * O PROBLEMA. Altura fixa obriga a escolher entre rápido e bonito. Numa peça com
 * parede vertical e uma cúpula em cima, 0,28 mm imprime a parede em metade do
 * tempo mas deixa a cúpula em degraus de escada; 0,08 mm deixa a cúpula lisa e
 * gasta o triplo do tempo na parede, onde não muda absolutamente nada — parede
 * vertical fica igual em qualquer altura de camada.
 *
 * A CONTA. O degrau visível não é a altura da camada: é a distância
 * PERPENDICULAR entre a superfície real e o canto do degrau. Num trecho de
 * superfície a ângulo α da horizontal, o degrau tem perna vertical `h` e perna
 * horizontal `h/tan α`, e a distância do canto até a hipotenusa é `h · cos α`.
 * Como `cos α` é exatamente `|n_z|` da normal daquela face:
 *
 *     degrau = h · |n_z|        =>        h = degrau_alvo / |n_z|
 *
 * Parede vertical tem `n_z = 0` e aceita a camada mais grossa que a máquina
 * permitir. Superfície quase horizontal tem `n_z ≈ 1` e exige a mais fina. É a
 * regra inteira, e ela cai da geometria — não é heurística ajustada no olho.
 *
 * ESCRITO DO ZERO. Nada vem de Slic3r, PrusaSlicer ou Cura.
 */

export interface AdaptiveOptions {
  /** Piso da máquina. Na Kobra X, 0,08 mm. */
  minLayerHeight: number;
  /** Teto da máquina. Na Kobra X, 0,28 mm. */
  maxLayerHeight: number;
  /**
   * Degrau máximo tolerado, em mm. Menor = mais liso e mais lento.
   * 0,05 mm é imperceptível ao toque; 0,15 mm já se vê contra a luz.
   */
  cuspMm: number;
  /** Primeira camada tem altura própria, para colar na mesa. */
  firstLayerHeight: number;
}

export const DEFAULT_ADAPTIVE_OPTIONS: AdaptiveOptions = {
  minLayerHeight: 0.08,
  maxLayerHeight: 0.28,
  cuspMm: 0.05,
  firstLayerHeight: 0.3,
};

interface FaceSpan {
  minZ: number;
  maxZ: number;
  /** |n_z| da normal, entre 0 (parede vertical) e 1 (superfície horizontal). */
  flatness: number;
}

/** Extensão em z e horizontalidade de cada triângulo. */
export function faceSpans(positions: Float32Array): FaceSpan[] {
  const spans: FaceSpan[] = [];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const az = positions[i + 2]!, bz = positions[i + 5]!, cz = positions[i + 8]!;

    const ux = positions[i + 3]! - positions[i]!;
    const uy = positions[i + 4]! - positions[i + 1]!;
    const uz = bz - az;
    const vx = positions[i + 6]! - positions[i]!;
    const vy = positions[i + 7]! - positions[i + 1]!;
    const vz = cz - az;

    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;

    spans.push({
      minZ: Math.min(az, bz, cz),
      maxZ: Math.max(az, bz, cz),
      flatness: Math.abs(nz) / len,
    });
  }
  return spans;
}

/**
 * Espessura de cada camada, de baixo para cima.
 *
 * A camada recebe a altura exigida pela face MAIS horizontal que ela atravessa —
 * a mais exigente manda. Uma camada que pega parede vertical e um chanfro raso
 * ao mesmo tempo tem de atender o chanfro, senão o degrau aparece nele.
 *
 * As faces vão para baldes por z para a busca não ser linear no total: sem isso,
 * uma peça de 1 M de triângulos com 1.000 camadas faria 10⁹ comparações.
 */
export function layerSchedule(
  positions: Float32Array,
  options: AdaptiveOptions = DEFAULT_ADAPTIVE_OPTIONS,
): number[] {
  const { minLayerHeight, maxLayerHeight, cuspMm, firstLayerHeight } = options;
  if (!(maxLayerHeight > 0) || minLayerHeight > maxLayerHeight) return [];

  const spans = faceSpans(positions);
  if (spans.length === 0) return [];

  let modelMin = Infinity;
  let modelMax = -Infinity;
  for (const s of spans) {
    if (s.minZ < modelMin) modelMin = s.minZ;
    if (s.maxZ > modelMax) modelMax = s.maxZ;
  }
  if (!(modelMax > modelMin)) return [];

  const bucketSize = Math.max(maxLayerHeight, 1);
  const buckets = new Map<number, FaceSpan[]>();
  for (const span of spans) {
    const from = Math.floor((span.minZ - modelMin) / bucketSize);
    const to = Math.floor((span.maxZ - modelMin) / bucketSize);
    for (let b = from; b <= to; b++) {
      const list = buckets.get(b);
      if (list) list.push(span);
      else buckets.set(b, [span]);
    }
  }

  /** Face mais horizontal que cruza a faixa [from, to]. */
  const flattestIn = (from: number, to: number): number => {
    let best = 0;
    const b0 = Math.floor((from - modelMin) / bucketSize);
    const b1 = Math.floor((to - modelMin) / bucketSize);
    for (let b = b0; b <= b1; b++) {
      for (const span of buckets.get(b) ?? []) {
        if (span.maxZ < from || span.minZ > to) continue;
        if (span.flatness > best) best = span.flatness;
      }
    }
    return best;
  };

  const clamp = (h: number): number => Math.min(maxLayerHeight, Math.max(minLayerHeight, h));

  const out: number[] = [];
  let bottom = modelMin;
  let index = 0;
  // Teto de segurança: com minLayerHeight muito pequeno o laço poderia ficar
  // longo demais para o browser. 100 mil camadas é mais do que qualquer peça
  // real da mesa da Kobra comporta.
  while (bottom < modelMax && out.length < 100_000) {
    if (index === 0) {
      out.push(firstLayerHeight);
      bottom += firstLayerHeight;
      index++;
      continue;
    }

    // Olha a faixa da camada mais grossa possível: se houver algo exigente ali,
    // a camada encolhe antes de chegar nele, não depois de já ter passado.
    const flatness = flattestIn(bottom, Math.min(bottom + maxLayerHeight, modelMax));
    const thickness = clamp(flatness > 1e-6 ? cuspMm / flatness : maxLayerHeight);

    out.push(thickness);
    bottom += thickness;
    index++;
  }

  return out;
}

/** Quantas camadas a altura fixa gastaria — para a tela mostrar o ganho. */
export function fixedLayerCount(
  positions: Float32Array,
  layerHeight: number,
  firstLayerHeight: number,
): number {
  const spans = faceSpans(positions);
  if (spans.length === 0 || !(layerHeight > 0)) return 0;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of spans) {
    if (s.minZ < minZ) minZ = s.minZ;
    if (s.maxZ > maxZ) maxZ = s.maxZ;
  }
  const height = maxZ - minZ - firstLayerHeight;
  return height <= 0 ? 1 : 1 + Math.ceil(height / layerHeight);
}
