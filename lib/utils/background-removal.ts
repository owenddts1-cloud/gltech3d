/**
 * Recorte de fundo das fotos de produto, 100% no browser.
 *
 * Não usa IA de propósito: as bibliotecas de segmentação disponíveis são AGPL
 * (@imgly/background-removal) ou trazem modelo com licença não-comercial
 * (RMBG-1.4), e este repositório é MIT. O que roda aqui é um flood-fill clássico
 * — sem dependência, sem download de modelo e sem enviar a foto do cliente para
 * lugar nenhum.
 *
 * A premissa é explícita: **os quatro cantos da imagem são fundo**. Isso vale para
 * foto de estúdio com fundo liso, que é o caso normal de peça impressa. Em fundo
 * complexo o resultado fica visivelmente ruim — e é por isso que a UI mostra a
 * prévia com controle de tolerância antes de aplicar. O usuário decide; o código
 * não finge que acertou.
 *
 * Para fundo que o algoritmo não dá conta, o caminho continua sendo subir um PNG
 * já transparente.
 */

export interface FloodFillOptions {
  /**
   * Distância de cor (Euclidiana em RGB, 0–441) até a cor de referência para o
   * pixel contar como fundo. Valores típicos: 20 (conservador) a 60 (agressivo).
   */
  tolerance?: number;
  /**
   * Largura da faixa de transição suave, como múltiplo da tolerância. A borda da
   * peça recebe alpha parcial em vez de serrilhar. `1` desliga o feather.
   */
  feather?: number;
}

export const DEFAULT_TOLERANCE = 32;
const DEFAULT_FEATHER = 1.6;

/** Distância Euclidiana em RGB. Máximo possível ≈ 441.67. */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Torna transparente o fundo **contíguo** que parte das bordas.
 *
 * Função pura sobre o array de pixels (RGBA) — não toca em canvas nem em DOM, o
 * que a torna testável no jsdom, onde canvas 2D não existe. Muta `data` no lugar
 * e devolve quantos pixels ficaram totalmente transparentes.
 *
 * Contiguidade é o ponto central: um brilho branco no meio de uma peça dourada
 * nunca é alcançado pela busca, então não vira buraco. A versão anterior deste
 * arquivo apagava qualquer pixel claro da imagem inteira e furava a peça.
 */
export function floodFillBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: FloodFillOptions = {},
): number {
  const tolerance = Math.max(0, options.tolerance ?? DEFAULT_TOLERANCE);
  const feather = Math.max(1, options.feather ?? DEFAULT_FEATHER);
  if (width <= 0 || height <= 0) return 0;
  // Tolerância zero: nada a fazer. Evita apagar fundo perfeitamente uniforme por
  // acidente quando o usuário arrasta o controle até o mínimo.
  if (tolerance === 0) return 0;

  // Cor de referência: média dos quatro cantos. Se a peça encosta num canto, a
  // referência fica poluída e o recorte falha de forma visível na prévia — que é
  // o comportamento honesto para um algoritmo com esta premissa.
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];
  let refR = 0;
  let refG = 0;
  let refB = 0;
  for (const c of corners) {
    refR += data[c] ?? 0;
    refG += data[c + 1] ?? 0;
    refB += data[c + 2] ?? 0;
  }
  refR /= corners.length;
  refG /= corners.length;
  refB /= corners.length;

  const total = width * height;
  const visited = new Uint8Array(total);
  // Pilha de índices de pixel. Int32Array evita o custo de push/pop de Array em
  // imagens grandes (uma foto de 4000×3000 tem 12 milhões de pixels).
  const stack = new Int32Array(total);
  let top = 0;

  const featherLimit = tolerance * feather;
  let cleared = 0;

  const push = (idx: number) => {
    if (idx < 0 || idx >= total || visited[idx]) return;
    visited[idx] = 1;
    stack[top++] = idx;
  };

  // Semeia em toda a moldura, não só num canto: fundo que entra pela lateral
  // também é alcançado.
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + (width - 1));
  }

  while (top > 0) {
    const idx = stack[--top]!;
    const p = idx * 4;
    const dist = colorDistance(data[p] ?? 0, data[p + 1] ?? 0, data[p + 2] ?? 0, refR, refG, refB);

    if (dist > featherLimit) continue;

    if (dist <= tolerance) {
      data[p + 3] = 0;
      cleared++;
    } else {
      // Faixa de transição: alpha proporcional, e a busca PARA aqui. Sem isso o
      // feather vazaria para dentro da peça.
      const ratio = (dist - tolerance) / (featherLimit - tolerance);
      const current = data[p + 3] ?? 255;
      data[p + 3] = Math.round(current * ratio);
      continue;
    }

    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) push(idx - 1);
    if (x < width - 1) push(idx + 1);
    if (y > 0) push(idx - width);
    if (y < height - 1) push(idx + width);
  }

  return cleared;
}

/** Resultado do recorte: o PNG e quanto da imagem virou fundo. */
export interface CutoutResult {
  blob: Blob;
  /** Fração da imagem removida, 0–1. Serve para avisar que deu errado. */
  clearedRatio: number;
}

/**
 * Baixa a imagem, recorta o fundo e devolve um PNG.
 *
 * Carrega via `fetch` + `createImageBitmap` em vez de `<img crossOrigin>`: se o
 * CORS do Storage falhar, o erro aparece aqui em vez de contaminar o canvas e
 * fazer `getImageData` estourar mais adiante. **Lança em qualquer falha** — sem
 * fallback silencioso devolvendo a imagem original como se tivesse funcionado.
 */
export async function cutoutBackground(
  imageUrl: string,
  options: FloodFillOptions = {},
): Promise<CutoutResult> {
  const response = await fetch(imageUrl, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`Não foi possível baixar a imagem (HTTP ${response.status}).`);
  }
  const bitmap = await createImageBitmap(await response.blob());

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D indisponível neste navegador.");

    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const cleared = floodFillBackground(imageData.data, canvas.width, canvas.height, options);
    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Falha ao gerar o PNG recortado.");

    return { blob, clearedRatio: cleared / (canvas.width * canvas.height) };
  } finally {
    bitmap.close();
  }
}
