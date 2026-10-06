/**
 * Checagem de conteúdo do confirm de /orcamento (lib/orcamento/file-check.ts):
 * tipo gravado coerente com a extensão + assinatura dos primeiros bytes.
 */
import { describe, expect, it } from "vitest";
import { checkOrcamentoFile, readHead, totalSizeFromHeaders } from "@/lib/orcamento/file-check";
import type { OrcamentoKind } from "@/lib/schemas/orcamento-upload";

const enc = (s: string) => new TextEncoder().encode(s);

function bytes(...parts: (number[] | string)[]): Uint8Array {
  const arrays = parts.map((p) => (typeof p === "string" ? enc(p) : Uint8Array.from(p)));
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

function check(kind: OrcamentoKind, type: string | null, head: Uint8Array, totalSize: number | null = head.length) {
  return checkOrcamentoFile({ kind, storedContentType: type, head, totalSize });
}

function binaryStl(triangles: number): { head: Uint8Array; total: number } {
  const head = new Uint8Array(84);
  new DataView(head.buffer).setUint32(80, triangles, true);
  return { head, total: 84 + triangles * 50 };
}

describe("assinaturas aceitas", () => {
  it("PNG, JPEG, WEBP, PDF, 3MF, STEP", () => {
    expect(check("png", "image/png", bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toEqual({ ok: true });
    expect(check("jpeg", "image/jpeg", bytes([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ ok: true });
    expect(check("webp", "image/webp", bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toEqual({ ok: true });
    expect(check("pdf", "application/pdf", bytes("%PDF-1.7\n"))).toEqual({ ok: true });
    expect(check("3mf", "model/3mf", bytes([0x50, 0x4b, 0x03, 0x04, 0x14]))).toEqual({ ok: true });
    expect(check("step", "model/step", bytes([0xef, 0xbb, 0xbf], "\r\nISO-10303-21;\nHEADER;"))).toEqual({ ok: true });
  });

  it("STL ASCII e STL binario com tamanho coerente", () => {
    expect(check("stl", "model/stl", bytes("solid cube\n facet normal 0 0 1\n"))).toEqual({ ok: true });
    const bin = binaryStl(12);
    expect(check("stl", "application/vnd.ms-pki.stl", bin.head, bin.total)).toEqual({ ok: true });
  });

  it("STL binario com 'solid' no cabecalho tambem passa", () => {
    const bin = binaryStl(3);
    bin.head.set(enc("solid exported by X"), 0);
    expect(check("stl", "model/stl", bin.head, bin.total)).toEqual({ ok: true });
  });

  it("OBJ em texto", () => {
    expect(check("obj", "model/obj", bytes("# Blender\nmtllib a.mtl\no Cube\nv 1 1 1\n"))).toEqual({ ok: true });
  });
});

describe("recusas", () => {
  it("tipo gravado que nao pertence a extensao", () => {
    const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(check("stl", "image/png", png).ok).toBe(false);
    expect(check("png", "application/octet-stream", png).ok).toBe(false);
    expect(check("png", null, png).ok).toBe(false);
  });

  it("aceita parametros no content-type gravado", () => {
    expect(check("pdf", "application/pdf; charset=binary", bytes("%PDF-1.4")).ok).toBe(true);
  });

  it("HTML disfarcado de PNG, OBJ ou STL", () => {
    const html = bytes("<!doctype html><script>alert(1)</script>");
    expect(check("png", "image/png", html).ok).toBe(false);
    expect(check("obj", "model/obj", html).ok).toBe(false);
    expect(check("stl", "model/stl", html).ok).toBe(false);
  });

  it("executavel (MZ) como STL binario com tamanho incoerente", () => {
    const exe = new Uint8Array(1024);
    exe.set([0x4d, 0x5a], 0);
    expect(check("stl", "model/stl", exe, 5_000_000).ok).toBe(false);
  });

  it("zip qualquer passa como 3MF so pela assinatura — limite conhecido", () => {
    // 3MF E um zip; validar o conteudo do pacote exigiria baixar o diretorio
    // central no fim do arquivo. O link continua num bucket privado, com
    // validade de 7 dias e servido como model/3mf (download, nao renderizado).
    expect(check("3mf", "model/3mf", bytes([0x50, 0x4b, 0x03, 0x04])).ok).toBe(true);
  });

  it("arquivo vazio", () => {
    expect(check("pdf", "application/pdf", new Uint8Array(0)).ok).toBe(false);
  });

  it("texto com NUL nao e OBJ", () => {
    expect(check("obj", "model/obj", bytes("v 1 1 1\n", [0], "x")).ok).toBe(false);
  });
});

describe("leitura parcial", () => {
  it("tamanho total pelo Content-Range ou, em 200, pelo Content-Length", () => {
    expect(totalSizeFromHeaders(206, new Headers({ "content-range": "bytes 0-1023/98765" }))).toBe(98765);
    expect(totalSizeFromHeaders(200, new Headers({ "content-length": "42" }))).toBe(42);
    expect(totalSizeFromHeaders(206, new Headers({ "content-length": "1024" }))).toBeNull();
  });

  it("readHead para no limite mesmo que o servidor ignore o Range", async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 100) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(600).fill(pulled));
      },
    });
    const head = await readHead(stream, 1024);
    expect(head.length).toBe(1024);
    expect(pulled).toBeLessThan(10);
  });

  it("readHead com corpo nulo devolve vazio", async () => {
    expect((await readHead(null)).length).toBe(0);
  });
});
