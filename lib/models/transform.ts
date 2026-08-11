/**
 * Transformação da peça: mover, girar e escalar.
 *
 * É a edição que 90% dos casos pedem. Escalar para caber na mesa, girar para
 * apoiar direito, espelhar para fazer o par de uma peça — nada disso exige
 * mexer em vértice, e tudo isso hoje obriga a voltar ao CAD.
 *
 * DUAS ARMADILHAS QUE ESTE MÓDULO RESOLVE:
 *
 * 1. ESCALAR EM TORNO DA ORIGEM MOVE A PEÇA. Um modelo desenhado longe do zero,
 *    escalado por 2, salta para o dobro da distância. O usuário pediu "o dobro
 *    do tamanho", não "o dobro do tamanho e do outro lado da mesa". Por isso a
 *    rotação e a escala acontecem em torno do CENTRO DA CAIXA da peça, e só
 *    depois vem a translação pedida.
 *
 * 2. ESPELHAR INVERTE A MALHA. Escala negativa em um eixo (ou três) troca o
 *    sentido de todas as normais: a peça fica com o "dentro" para fora, o
 *    fatiador lê o material invertido e o resultado é lixo — sem erro nenhum no
 *    caminho. A correção é trocar a ordem de dois vértices de cada triângulo
 *    quando o determinante da matriz é negativo.
 *
 * ESCRITO DO ZERO. Nada vem de Blender, Meshmixer ou PrusaSlicer.
 */

import { applyMat3, type Mat3, type Vec3 } from "./orientation";
import { boundsOf } from "./stl";

export interface Transform {
  /** Graus. Aplicados na ordem Z, depois Y, depois X. */
  rotationDeg: Vec3;
  /** Fator por eixo. Negativo espelha. */
  scale: Vec3;
  /** Deslocamento final, em mm. */
  translationMm: Vec3;
}

export const IDENTITY_TRANSFORM: Transform = {
  rotationDeg: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  translationMm: { x: 0, y: 0, z: 0 },
};

const mul = (a: Mat3, b: Mat3): Mat3 => {
  const out: number[][] = [[], [], []];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i]![j] = a[i]![0]! * b[0]![j]! + a[i]![1]! * b[1]![j]! + a[i]![2]! * b[2]![j]!;
    }
  }
  return out as Mat3;
};

const rad = (deg: number): number => (deg * Math.PI) / 180;

function rotX(deg: number): Mat3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}
function rotY(deg: number): Mat3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}
function rotZ(deg: number): Mat3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

/**
 * Matriz linear da transformação: rotação × escala.
 *
 * A ordem é X(Y(Z(escala · v))). Escala PRIMEIRO e no eixo do próprio modelo —
 * escalar depois de girar deformaria a peça em diagonal, que quase nunca é o que
 * se quer ao digitar "200% em X".
 */
export function transformMatrix(t: Transform): Mat3 {
  const scale: Mat3 = [
    [t.scale.x, 0, 0],
    [0, t.scale.y, 0],
    [0, 0, t.scale.z],
  ];
  return mul(rotX(t.rotationDeg.x), mul(rotY(t.rotationDeg.y), mul(rotZ(t.rotationDeg.z), scale)));
}

/** Determinante. Negativo = a transformação espelha. */
export function determinant(m: Mat3): number {
  return (
    m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
    m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
    m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!)
  );
}

export function isIdentityTransform(t: Transform): boolean {
  const e = 1e-9;
  return (
    Math.abs(t.rotationDeg.x) < e &&
    Math.abs(t.rotationDeg.y) < e &&
    Math.abs(t.rotationDeg.z) < e &&
    Math.abs(t.scale.x - 1) < e &&
    Math.abs(t.scale.y - 1) < e &&
    Math.abs(t.scale.z - 1) < e &&
    Math.abs(t.translationMm.x) < e &&
    Math.abs(t.translationMm.y) < e &&
    Math.abs(t.translationMm.z) < e
  );
}

/**
 * Aplica a transformação aos triângulos.
 *
 * Gira e escala em torno do centro da caixa da peça, depois translada. Se a
 * matriz espelha, a ordem dos vértices de cada triângulo é invertida para as
 * normais continuarem apontando para fora.
 */
export function applyTransform(positions: Float32Array, t: Transform): Float32Array {
  if (positions.length < 9) return new Float32Array(positions);

  const m = transformMatrix(t);
  const mirrored = determinant(m) < 0;

  const box = boundsOf(positions);
  const center: Vec3 = {
    x: (box.min[0] + box.max[0]) / 2,
    y: (box.min[1] + box.max[1]) / 2,
    z: (box.min[2] + box.max[2]) / 2,
  };

  const out = new Float32Array(positions.length);
  const place = (i: number, at: number): void => {
    const v = applyMat3(m, {
      x: positions[i]! - center.x,
      y: positions[i + 1]! - center.y,
      z: positions[i + 2]! - center.z,
    });
    out[at] = v.x + center.x + t.translationMm.x;
    out[at + 1] = v.y + center.y + t.translationMm.y;
    out[at + 2] = v.z + center.z + t.translationMm.z;
  };

  for (let i = 0; i + 8 < positions.length; i += 9) {
    if (mirrored) {
      // Troca o 2º e o 3º vértice: desfaz a inversão de sentido que o espelho
      // causou. Sem isto a peça sai com o dentro para fora, e nada acusa.
      place(i, i);
      place(i + 6, i + 3);
      place(i + 3, i + 6);
    } else {
      place(i, i);
      place(i + 3, i + 3);
      place(i + 6, i + 6);
    }
  }

  return out;
}

/** Texto curto do que foi feito, para a nota da versão. */
export function describeTransform(t: Transform): string {
  const partes: string[] = [];
  const n = (v: number) => (Math.round(v * 100) / 100).toString();

  const { x: rx, y: ry, z: rz } = t.rotationDeg;
  if (rx || ry || rz) {
    partes.push(`girou ${[rx && `${n(rx)}° X`, ry && `${n(ry)}° Y`, rz && `${n(rz)}° Z`]
      .filter(Boolean)
      .join(", ")}`);
  }

  const { x: sx, y: sy, z: sz } = t.scale;
  if (sx < 0 || sy < 0 || sz < 0) partes.push("espelhou");
  const uniforme = Math.abs(sx) === Math.abs(sy) && Math.abs(sy) === Math.abs(sz);
  if (uniforme && Math.abs(sx) !== 1) partes.push(`escala ${n(Math.abs(sx) * 100)}%`);
  else if (!uniforme) {
    partes.push(`escala ${n(Math.abs(sx) * 100)}/${n(Math.abs(sy) * 100)}/${n(Math.abs(sz) * 100)}%`);
  }

  const { x: tx, y: ty, z: tz } = t.translationMm;
  if (tx || ty || tz) partes.push(`moveu ${n(tx)}, ${n(ty)}, ${n(tz)} mm`);

  return partes.length > 0 ? partes.join(" · ") : "sem alteração";
}
