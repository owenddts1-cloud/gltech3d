/**
 * 3MF — importar e exportar.
 *
 * POR QUE 3MF E NÃO SÓ STL. STL guarda triângulos soltos e mais nada: sem
 * unidade (é milímetro? polegada? ninguém sabe), sem transformação, sem nome, e
 * repetindo cada vértice em cada face que o toca. 3MF é um ZIP com XML: traz a
 * unidade declarada, os vértices indexados uma vez só, e a matriz de posição de
 * cada item na mesa. É o formato que a impressão 3D deveria ter tido desde o
 * começo.
 *
 * A UNIDADE É O QUE MAIS IMPORTA AQUI. Um 3MF em polegadas lido como milímetro
 * sai 25,4 vezes menor, e nada no arquivo reclama — a peça só sai errada. A
 * conversão é feita na leitura, sempre, e o modelo interno é SEMPRE milímetro.
 *
 * ESCRITO DO ZERO a partir da especificação. Nada vem de lib3mf, PrusaSlicer ou
 * Cura.
 */

import { readZip, writeZip } from "./zip";
import { boundsOf, type ParsedStl } from "./stl";
import { applyMat3, type Mat3 } from "./orientation";

/** Fator para milímetro. A spec do 3MF define estas seis. */
const UNIT_TO_MM: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

const MODEL_PATH = "3D/3dmodel.model";

/** Extrai o valor de um atributo. O XML do 3MF é simples e regular. */
function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(tag);
  return match ? match[1]! : null;
}

const numAttr = (tag: string, name: string, fallback = 0): number => {
  const raw = attr(tag, name);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

/**
 * Matriz de item da mesa: 12 números em ordem de coluna (3 linhas de base +
 * translação). Devolve `null` quando não há transformação.
 */
function parseTransform(raw: string | null): { m: Mat3; t: [number, number, number] } | null {
  if (!raw) return null;
  const n = raw.trim().split(/\s+/).map(Number);
  if (n.length !== 12 || n.some((v) => !Number.isFinite(v))) return null;
  return {
    // A spec lista por LINHA de 3, com a translação nos três últimos.
    m: [
      [n[0]!, n[3]!, n[6]!],
      [n[1]!, n[4]!, n[7]!],
      [n[2]!, n[5]!, n[8]!],
    ],
    t: [n[9]!, n[10]!, n[11]!],
  };
}

/**
 * Lê um 3MF e devolve triângulos soltos, no mesmo formato do parser de STL.
 *
 * Os objetos são achatados: cada `<item>` da build entra com a sua matriz
 * aplicada. Componentes aninhados (`<components>`) são resolvidos com um teto de
 * profundidade — 3MF permite referência circular, e sem o teto um arquivo
 * malicioso ou só malfeito trava a aba.
 */
export async function parse3mf(buffer: ArrayBuffer): Promise<ParsedStl> {
  const entries = await readZip(buffer);
  const model = entries.find((e) => e.name.toLowerCase() === MODEL_PATH.toLowerCase())
    ?? entries.find((e) => e.name.toLowerCase().endsWith(".model"));
  if (!model) throw new Error("3MF sem 3D/3dmodel.model dentro. Arquivo incompleto?");

  const xml = new TextDecoder().decode(model.data);

  const modelTag = /<model\b[^>]*>/i.exec(xml)?.[0] ?? "";
  const unit = (attr(modelTag, "unit") ?? "millimeter").toLowerCase();
  const scale = UNIT_TO_MM[unit];
  if (scale === undefined) {
    throw new Error(`Unidade "${unit}" desconhecida no 3MF. Não vou adivinhar a escala.`);
  }

  /** id do objeto → malha própria e/ou componentes referenciados. */
  interface Obj {
    vertices: number[];
    triangles: number[];
    components: Array<{ objectId: string; transform: ReturnType<typeof parseTransform> }>;
  }
  const objects = new Map<string, Obj>();

  for (const block of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/gi)) {
    const id = attr(`<object${block[1]}>`, "id");
    if (!id) continue;
    const body = block[2] ?? "";

    const vertices: number[] = [];
    for (const v of body.matchAll(/<vertex\b[^>]*\/?>/gi)) {
      const tag = v[0];
      vertices.push(numAttr(tag, "x"), numAttr(tag, "y"), numAttr(tag, "z"));
    }

    const triangles: number[] = [];
    for (const t of body.matchAll(/<triangle\b[^>]*\/?>/gi)) {
      const tag = t[0];
      triangles.push(numAttr(tag, "v1", -1), numAttr(tag, "v2", -1), numAttr(tag, "v3", -1));
    }

    const components: Obj["components"] = [];
    for (const c of body.matchAll(/<component\b[^>]*\/?>/gi)) {
      const tag = c[0];
      const objectId = attr(tag, "objectid");
      if (objectId) components.push({ objectId, transform: parseTransform(attr(tag, "transform")) });
    }

    objects.set(id, { vertices, triangles, components });
  }

  if (objects.size === 0) throw new Error("3MF sem nenhum objeto com geometria.");

  const out: number[] = [];
  const MAX_DEPTH = 16;

  const emit = (
    objectId: string,
    m: Mat3 | null,
    t: [number, number, number],
    depth: number,
  ): void => {
    if (depth > MAX_DEPTH) return; // 3MF permite referência circular
    const obj = objects.get(objectId);
    if (!obj) return;

    const place = (x: number, y: number, z: number): [number, number, number] => {
      const v = m ? applyMat3(m, { x, y, z }) : { x, y, z };
      return [(v.x + t[0]) * scale, (v.y + t[1]) * scale, (v.z + t[2]) * scale];
    };

    for (let i = 0; i + 2 < obj.triangles.length; i += 3) {
      const idx = [obj.triangles[i]!, obj.triangles[i + 1]!, obj.triangles[i + 2]!];
      // Índice fora da faixa: pula o triângulo em vez de emitir NaN. Um arquivo
      // meio corrompido tem de perder uma face, não virar peça inteira inválida.
      if (idx.some((k) => k < 0 || k * 3 + 2 >= obj.vertices.length)) continue;
      for (const k of idx) {
        out.push(...place(obj.vertices[k * 3]!, obj.vertices[k * 3 + 1]!, obj.vertices[k * 3 + 2]!));
      }
    }

    for (const component of obj.components) {
      const child = component.transform;
      // Composição simplificada: aplica a matriz do componente e SOMA a
      // translação já acumulada. Cobre o caso comum (um nível de componentes com
      // deslocamento); rotação aninhada sobre rotação sairia deslocada, e por
      // isso o teto de profundidade também existe.
      emit(
        component.objectId,
        child?.m ?? m,
        child ? [t[0] + child.t[0], t[1] + child.t[1], t[2] + child.t[2]] : t,
        depth + 1,
      );
    }
  };

  const build = /<build\b[^>]*>([\s\S]*?)<\/build>/i.exec(xml)?.[1] ?? "";
  const items = [...build.matchAll(/<item\b[^>]*\/?>/gi)];

  if (items.length > 0) {
    for (const item of items) {
      const tag = item[0];
      const objectId = attr(tag, "objectid");
      if (!objectId) continue;
      const transform = parseTransform(attr(tag, "transform"));
      emit(objectId, transform?.m ?? null, transform?.t ?? [0, 0, 0], 0);
    }
  } else {
    // Sem <build>, emite todo objeto que tenha malha própria. Fora da spec, mas
    // aparece em arquivo gerado por script — melhor ler que recusar.
    for (const [id, obj] of objects) {
      if (obj.triangles.length > 0) emit(id, null, [0, 0, 0], 0);
    }
  }

  if (out.length < 9) throw new Error("3MF sem triângulo nenhum depois de resolver a build.");

  const positions = new Float32Array(out);
  return {
    positions,
    normals: new Float32Array(0), // calculadas da geometria quando precisar
    boundingBox: boundsOf(positions),
    numTriangles: positions.length / 9,
    format: "binary",
  };
}

/** Escreve um 3MF a partir de triângulos soltos. */
export function write3mf(positions: Float32Array, name = "peca"): Uint8Array {
  // Vértices indexados: é metade da razão de o 3MF existir. Um cubo em STL
  // repete 8 vértices 36 vezes; aqui cada um aparece uma vez.
  const index = new Map<string, number>();
  const vertices: number[] = [];
  const triangles: number[] = [];

  for (let i = 0; i + 2 < positions.length; i += 3) {
    const x = positions[i]!, y = positions[i + 1]!, z = positions[i + 2]!;
    // Chave por valor arredondado a 1 µm: bem abaixo do que qualquer bico
    // resolve, e evita que erro de float deixe o mesmo canto com dois vértices.
    const key = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
    let at = index.get(key);
    if (at === undefined) {
      at = vertices.length / 3;
      index.set(key, at);
      vertices.push(x, y, z);
    }
    triangles.push(at);
  }

  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(6).replace(/\.?0+$/, "") || "0" : "0");

  const vertexXml = [];
  for (let i = 0; i + 2 < vertices.length; i += 3) {
    vertexXml.push(
      `<vertex x="${fmt(vertices[i]!)}" y="${fmt(vertices[i + 1]!)}" z="${fmt(vertices[i + 2]!)}"/>`,
    );
  }
  const triangleXml = [];
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    triangleXml.push(
      `<triangle v1="${triangles[i]}" v2="${triangles[i + 1]}" v3="${triangles[i + 2]}"/>`,
    );
  }

  const safeName = name.replace(/[<>&"']/g, "");
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <metadata name="Application">DeskcommCRM</metadata>
 <metadata name="Title">${safeName}</metadata>
 <resources>
  <object id="1" type="model">
   <mesh>
    <vertices>${vertexXml.join("")}</vertices>
    <triangles>${triangleXml.join("")}</triangles>
   </mesh>
  </object>
 </resources>
 <build><item objectid="1"/></build>
</model>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rel0" Target="/${MODEL_PATH}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

  const encoder = new TextEncoder();
  return writeZip([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rels) },
    { name: MODEL_PATH, data: encoder.encode(model) },
  ]);
}
