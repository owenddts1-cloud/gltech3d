/**
 * Orientação da peça na mesa.
 *
 * O QUE ISTO RESOLVE, com número medido. O PAYLOAD, fatiado na orientação em
 * que o STL foi salvo, pede **22,85 cm³ de suporte** e sobe de 2h21 para 4h46 —
 * o dobro do tempo e quase o dobro do filamento, tudo virando lixo que ainda
 * precisa ser quebrado fora à mão. Girar a peça antes de fatiar é a decisão de
 * maior impacto do fluxo inteiro, e é a única que o fatiador não pode tomar
 * sozinho depois.
 *
 * COMO. Uma peça bem apoiada quase sempre tem uma FACE encostada na mesa. Então
 * os candidatos não são rotações arbitrárias: são as direções normais das
 * próprias faces do modelo. Testar cada uma como "para baixo" cobre todo apoio
 * plano possível, e o custo é linear no número de faces distintas.
 *
 * Cada candidato recebe três notas — suporte, apoio na mesa e altura — e a
 * combinação é explícita, não um número mágico. Ver `scoreOrientation`.
 *
 * Módulo PURO: sem DOM, sem `self`. Roda no worker e no Vitest.
 *
 * ESCRITO DO ZERO. Nada vem de Meshmixer, PrusaSlicer, Cura ou Tweaker-3.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Matriz 3×3 em ordem de linha: `m[linha][coluna]`. */
export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);

function normalize(v: Vec3): Vec3 {
  const len = length(v);
  if (len < 1e-12) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function applyMat3(m: Mat3, v: Vec3): Vec3 {
  return {
    x: m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
    y: m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
    z: m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z,
  };
}

/**
 * Rotação que leva `down` para −Z, ou seja, que põe essa direção contra a mesa.
 *
 * Fórmula de Rodrigues em torno do eixo perpendicular aos dois vetores. Os dois
 * casos degenerados precisam de tratamento explícito, senão o eixo sai nulo e a
 * matriz vira NaN — e NaN em geometria não estoura, só produz peça vazia:
 *
 *  - já aponta para −Z: identidade, nada a fazer
 *  - aponta para +Z (oposto exato): meia volta em torno de QUALQUER eixo
 *    perpendicular; escolho um estável, longe do vetor original
 */
export function rotationToAlignDown(down: Vec3): Mat3 {
  const d = normalize(down);
  const target: Vec3 = { x: 0, y: 0, z: -1 };
  const c = dot(d, target);

  if (c > 1 - 1e-9) return IDENTITY;

  if (c < -1 + 1e-9) {
    // Antiparalelo: gira 180° em torno de um eixo perpendicular qualquer.
    const seed: Vec3 = Math.abs(d.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const axis = normalize(cross(d, seed));
    return rodrigues(axis, Math.PI);
  }

  return rodrigues(normalize(cross(d, target)), Math.acos(Math.max(-1, Math.min(1, c))));
}

function rodrigues(axis: Vec3, angle: number): Mat3 {
  const { x, y, z } = axis;
  const s = Math.sin(angle);
  const t = 1 - Math.cos(angle);
  const co = Math.cos(angle);
  return [
    [co + x * x * t, x * y * t - z * s, x * z * t + y * s],
    [y * x * t + z * s, co + y * y * t, y * z * t - x * s],
    [z * x * t - y * s, z * y * t + x * s, co + z * z * t],
  ];
}

export interface Face {
  normal: Vec3;
  /** mm² */
  area: number;
  centroid: Vec3;
}

/**
 * Normais e áreas por face, calculadas da GEOMETRIA.
 *
 * Deliberadamente ignora as normais gravadas no STL: metade dos exportadores
 * grava zero ou aponta para o lado errado, e uma normal invertida faz esta
 * análise recomendar exatamente a pior orientação. A ordem dos vértices é mais
 * confiável que o campo de normal.
 */
export function facesOf(positions: Float32Array): Face[] {
  const faces: Face[] = [];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    const ax = positions[i]!, ay = positions[i + 1]!, az = positions[i + 2]!;
    const bx = positions[i + 3]!, by = positions[i + 4]!, bz = positions[i + 5]!;
    const cx = positions[i + 6]!, cy = positions[i + 7]!, cz = positions[i + 8]!;

    const n = cross(
      { x: bx - ax, y: by - ay, z: bz - az },
      { x: cx - ax, y: cy - ay, z: cz - az },
    );
    const twiceArea = length(n);
    if (twiceArea < 1e-12) continue; // triângulo degenerado não tem direção

    faces.push({
      normal: { x: n.x / twiceArea, y: n.y / twiceArea, z: n.z / twiceArea },
      area: twiceArea / 2,
      centroid: { x: (ax + bx + cx) / 3, y: (ay + by + cy) / 3, z: (az + bz + cz) / 3 },
    });
  }
  return faces;
}

/**
 * Direções candidatas a "para baixo".
 *
 * Agrupa normais parecidas: um cilindro tem centenas de faces laterais quase
 * idênticas, e testar todas custa caro sem mudar o resultado. A quantização é
 * grosseira de propósito (~5°), porque a diferença entre apoiar numa face e
 * apoiar noutra 3° adiante não muda a impressão.
 *
 * As 6 direções dos eixos entram sempre, mesmo que nenhuma face aponte para
 * elas: são as orientações que o usuário espera ver testadas, e uma peça
 * orgânica pode não ter face nenhuma alinhada a eixo.
 */
export function candidateDirections(faces: readonly Face[], maxCandidates = 64): Vec3[] {
  const buckets = new Map<string, { dir: Vec3; area: number }>();

  const push = (n: Vec3, area: number) => {
    const key = `${Math.round(n.x * 12)}:${Math.round(n.y * 12)}:${Math.round(n.z * 12)}`;
    const found = buckets.get(key);
    if (found) found.area += area;
    else buckets.set(key, { dir: n, area });
  };

  for (const face of faces) push(face.normal, face.area);

  // Ordena por área: a face grande é a candidata a apoio que importa.
  const ranked = [...buckets.values()].sort((a, b) => b.area - a.area).slice(0, maxCandidates);

  const axes: Vec3[] = [
    { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 1 },
    { x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 },
    { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
  ];

  const out: Vec3[] = [...axes];
  for (const { dir } of ranked) {
    // Já coberto por um candidato quase igual? Então não repete.
    if (!out.some((existing) => dot(existing, dir) > 0.995)) out.push(dir);
  }
  return out;
}

export interface OrientationScore {
  /** Direção do modelo que fica contra a mesa. */
  down: Vec3;
  /** Proxy de volume de suporte, em cm³. Quanto menor, melhor. */
  supportCm3: number;
  /** Área apoiada na mesa, em mm². Quanto maior, melhor. */
  bedContactMm2: number;
  /** Altura resultante, em mm. Menor = menos camadas = mais rápido. */
  heightMm: number;
  /** Nota final. MENOR é melhor. */
  score: number;
}

export interface OrientationOptions {
  /** Inclinação máxima (da vertical) que imprime sem apoio. */
  maxOverhangDeg: number;
  /**
   * Quanto pesa perder apoio na mesa, em cm³ de suporte equivalente por cm² de
   * apoio. Peça que descola no meio da impressão custa a peça inteira, então
   * vale trocar um pouco de suporte por base firme — mas não muito.
   */
  bedWeight: number;
  /** Quanto pesa a altura, em cm³ equivalente por cm de altura. */
  heightWeight: number;
}

export const DEFAULT_ORIENTATION_OPTIONS: OrientationOptions = {
  maxOverhangDeg: 45,
  bedWeight: 0.5,
  heightWeight: 0.2,
};

/**
 * Avalia uma orientação candidata.
 *
 * SUPORTE. Uma face precisa de apoio quando está inclinada mais que
 * `maxOverhangDeg` da vertical. A normal de uma parede inclinada θ da vertical
 * aponta θ abaixo da horizontal, então `−n.z = sin(θ)`, e o critério vira
 * `−n.z > sin(maxOverhang)`. O custo estimado é `área × altura do centroide`:
 * uma face em balanço a 80 mm da mesa precisa de uma coluna de 80 mm embaixo,
 * uma a 2 mm quase não precisa de nada. Multiplicar pela área e pela altura é a
 * aproximação mais simples que respeita as duas coisas.
 *
 * É um PROXY, não o volume exato — o exato sai do `generateSupports`, que roda
 * o fatiamento inteiro e é caro demais para 60 candidatos. Serve para ORDENAR
 * candidatos, que é o que se precisa aqui.
 *
 * APOIO NA MESA. Área das faces que ficam horizontais viradas para baixo E na
 * altura mínima. Uma face grande no fundo, mas 5 mm acima do ponto mais baixo,
 * não toca mesa nenhuma.
 */
export function scoreOrientation(
  faces: readonly Face[],
  positions: Float32Array,
  down: Vec3,
  options: OrientationOptions = DEFAULT_ORIENTATION_OPTIONS,
): OrientationScore {
  if (faces.length === 0) {
    return { down, supportCm3: 0, bedContactMm2: 0, heightMm: 0, score: 0 };
  }

  const m = rotationToAlignDown(down);
  const sinLimit = Math.sin((options.maxOverhangDeg * Math.PI) / 180);

  // Nível da mesa e altura da peça, medidos nos VÉRTICES.
  //
  // BUG QUE ISTO CORRIGE: media a altura contra o menor CENTROIDE. Num cone
  // invertido todas as faces laterais são congruentes e têm o mesmo centroide,
  // então a altura dava zero e o suporte sumia — a função devolvia 0 cm³ para a
  // pior orientação possível.
  //
  // O atalho: a rotação leva `down` exatamente em −Z, logo a terceira linha da
  // matriz É `−down` (as duas são unitárias e o produto escalar vale −1).
  // Portanto `z` depois de girar é `−dot(v, down)`, e o nível da mesa sai numa
  // varredura de produtos escalares, sem montar matriz por vértice.
  const d = normalize(down);
  let bedZ = Infinity;
  let topZ = -Infinity;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const z = -(positions[i]! * d.x + positions[i + 1]! * d.y + positions[i + 2]! * d.z);
    if (z < bedZ) bedZ = z;
    if (z > topZ) topZ = z;
  }
  if (!Number.isFinite(bedZ)) {
    return { down, supportCm3: 0, bedContactMm2: 0, heightMm: 0, score: 0 };
  }

  const rotated = faces.map((face) => ({
    normal: applyMat3(m, face.normal),
    centroid: applyMat3(m, face.centroid),
    area: face.area,
  }));

  // Tolerância do contato com a mesa: uma camada. Abaixo disso o filete da
  // primeira camada esmaga e encosta na prática.
  const BED_EPS = 0.3;

  let supportProxy = 0;
  let bedContact = 0;
  for (const face of rotated) {
    const downward = -face.normal.z;
    const height = face.centroid.z - bedZ;

    if (downward > sinLimit) supportProxy += face.area * height * downward;
    if (downward > 0.98 && height <= BED_EPS) bedContact += face.area;
  }

  const supportCm3 = supportProxy / 1000; // mm³ → cm³
  const heightMm = topZ - bedZ;

  const score =
    supportCm3 -
    (bedContact / 100) * options.bedWeight + // mm² → cm²
    (heightMm / 10) * options.heightWeight; // mm → cm

  return { down, supportCm3, bedContactMm2: bedContact, heightMm, score };
}

export interface OrientationResult {
  /** A melhor, já ordenada em primeiro. */
  best: OrientationScore;
  /** Como a peça está agora, sem girar. Base de comparação. */
  current: OrientationScore;
  /** Matriz a aplicar nos vértices. Identidade se a atual já é a melhor. */
  rotation: Mat3;
  /** Os melhores candidatos, para a tela oferecer alternativas. */
  ranked: OrientationScore[];
}

/** Encontra a melhor orientação para a peça. */
export function bestOrientation(
  positions: Float32Array,
  options: OrientationOptions = DEFAULT_ORIENTATION_OPTIONS,
): OrientationResult {
  const faces = facesOf(positions);
  const current = scoreOrientation(faces, positions, { x: 0, y: 0, z: -1 }, options);

  if (faces.length === 0) {
    return { best: current, current, rotation: IDENTITY, ranked: [current] };
  }

  const ranked = candidateDirections(faces)
    .map((down) => scoreOrientation(faces, positions, down, options))
    .sort((a, b) => a.score - b.score);

  const best = ranked[0]!;
  // Só recomenda girar se o ganho for real. Girar por 2% de melhora só confunde
  // quem já orientou a peça de propósito no CAD.
  const worthwhile = best.score < current.score - Math.abs(current.score) * 0.05 - 1e-6;

  return {
    best: worthwhile ? best : current,
    current,
    rotation: worthwhile ? rotationToAlignDown(best.down) : IDENTITY,
    ranked: ranked.slice(0, 8),
  };
}

/**
 * Aplica a rotação aos vértices e assenta a peça na mesa.
 *
 * O assentamento não é detalhe: girar em torno da origem joga a peça para
 * qualquer lugar, inclusive abaixo de z=0, e o fatiador começaria a cortar no
 * ar. Depois de girar, translada para `minZ = 0` e centra em XY.
 */
export function applyOrientation(positions: Float32Array, rotation: Mat3): Float32Array {
  const out = new Float32Array(positions.length);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (let i = 0; i + 2 < positions.length; i += 3) {
    const v = applyMat3(rotation, {
      x: positions[i]!,
      y: positions[i + 1]!,
      z: positions[i + 2]!,
    });
    out[i] = v.x;
    out[i + 1] = v.y;
    out[i + 2] = v.z;
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z;
  }

  if (!Number.isFinite(minZ)) return out;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (let i = 0; i + 2 < out.length; i += 3) {
    out[i] = out[i]! - cx;
    out[i + 1] = out[i + 1]! - cy;
    out[i + 2] = out[i + 2]! - minZ;
  }
  return out;
}
