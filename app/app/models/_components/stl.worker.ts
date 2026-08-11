/**
 * Web Worker de parsing de STL.
 *
 * Casca fina: toda a lógica está em `lib/models/stl.ts`, que é puro e testado.
 * Antes o parser vivia em `public/workers/stl-parser.js` como script clássico —
 * um arquivo em `public/` não é importável, então não havia como testá-lo, e foi
 * assim que a ausência de suporte a STL ASCII passou despercebida.
 *
 * Worker bundleado (`new Worker(new URL(...), { type: "module" })`), o que
 * permite o import acima.
 */

import { parseStlBuffer } from "@/lib/models/stl";

export interface StlWorkerRequest {
  arrayBuffer: ArrayBuffer;
}

export type StlWorkerResponse =
  | {
      ok: true;
      positions: ArrayBuffer;
      normals: ArrayBuffer;
      boundingBox: { min: [number, number, number]; max: [number, number, number] };
      numTriangles: number;
      format: "binary" | "ascii";
    }
  | { ok: false; error: string };

/**
 * O tsconfig do app carrega a lib DOM, então `self` é tipado como `Window` e
 * `postMessage` aparece com a assinatura de janela (que pede `targetOrigin`).
 * Ligar a lib `webworker` globalmente entraria em conflito com o resto do app.
 * Este escopo mínimo descreve o que o worker realmente usa — sem `any`.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<StlWorkerRequest>) => void) | null;
  postMessage: (message: StlWorkerResponse, transfer?: Transferable[]) => void;
}

const ctx = self as unknown as WorkerScope;

ctx.onmessage = (event) => {
  try {
    const parsed = parseStlBuffer(event.data.arrayBuffer);
    const response: StlWorkerResponse = {
      ok: true,
      positions: parsed.positions.buffer as ArrayBuffer,
      normals: parsed.normals.buffer as ArrayBuffer,
      boundingBox: parsed.boundingBox,
      numTriangles: parsed.numTriangles,
      format: parsed.format,
    };
    // Transferable: um STL de 26 MB não pode ser copiado de volta para a main
    // thread — seria bloqueio garantido.
    ctx.postMessage(response, [response.positions, response.normals]);
  } catch (error) {
    ctx.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao parsear o STL.",
    });
  }
};
