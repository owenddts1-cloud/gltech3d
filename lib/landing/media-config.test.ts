import { describe, it, expect } from "vitest";

import {
  safeName,
  mediaKindOf,
  mimeFromExtension,
  compareMediaNames,
  LANDING_MEDIA_MIME,
} from "./media-config";

describe("safeName", () => {
  it("remove acento, espaço e caractere especial", () => {
    expect(safeName("Luminária Lua Cheia.png")).toBe("Luminaria-Lua-Cheia.png");
  });

  it("neutraliza path traversal", () => {
    // Sem isto, um nome de arquivo poderia escrever fora da pasta da org.
    expect(safeName("../../etc/passwd")).toBe("passwd");
    expect(safeName("..\\..\\windows\\system32")).toBe("system32");
    expect(safeName("/absoluto/x.png")).toBe("x.png");
  });

  it("nunca devolve string vazia", () => {
    expect(safeName("")).toBe("arquivo");
    expect(safeName("///")).toBe("arquivo");
  });

  it("é estável: mesmo nome, mesma saída", () => {
    // A deduplicação do importador depende disso — nome instável geraria um
    // caminho novo a cada execução e a peça acumularia fotos repetidas.
    const input = "Foto Ação 01.PNG";
    expect(safeName(input)).toBe(safeName(input));
  });
});

describe("mediaKindOf", () => {
  it("separa vídeo de imagem (colunas distintas no banco)", () => {
    expect(mediaKindOf("clipe.mp4")).toBe("video");
    expect(mediaKindOf("clipe.WEBM")).toBe("video");
    expect(mediaKindOf("foto.png")).toBe("image");
    expect(mediaKindOf("foto.jpeg")).toBe("image");
  });
});

describe("mimeFromExtension", () => {
  it("resolve as extensões que o bucket aceita", () => {
    for (const [ext, mime] of [
      ["a.png", "image/png"], ["a.jpg", "image/jpeg"], ["a.jpeg", "image/jpeg"],
      ["a.webp", "image/webp"], ["a.avif", "image/avif"], ["a.gif", "image/gif"],
      ["a.mp4", "video/mp4"], ["a.webm", "video/webm"],
    ] as const) {
      expect(mimeFromExtension(ext)).toBe(mime);
    }
  });

  it("todo MIME devolvido é aceito pelo bucket", () => {
    // Devolver um MIME fora da allowlist faria o upload ser recusado pelo
    // Storage com um erro que não diz o motivo.
    for (const name of ["a.png", "a.jpg", "a.webp", "a.avif", "a.gif", "a.mp4", "a.webm"]) {
      expect(LANDING_MEDIA_MIME).toContain(mimeFromExtension(name));
    }
  });

  it("recusa o que não é mídia", () => {
    expect(mimeFromExtension("peca.stl")).toBeNull();
    expect(mimeFromExtension("projeto.3mf")).toBeNull();
    expect(mimeFromExtension("semextensao")).toBeNull();
  });
});

describe("compareMediaNames", () => {
  it("ordena numericamente, não alfabeticamente", () => {
    // `sort()` puro devolveria foto10 antes de foto2 — e como images[0] é a
    // CAPA, isso trocaria a foto principal da peça.
    const sorted = ["foto10.png", "foto2.png", "foto1.png"].sort(compareMediaNames);
    expect(sorted).toEqual(["foto1.png", "foto2.png", "foto10.png"]);
  });

  it("prioriza capa e prefixo 00", () => {
    expect(["b.png", "capa.png", "a.png"].sort(compareMediaNames)[0]).toBe("capa.png");
    expect(["z.png", "00-principal.png"].sort(compareMediaNames)[0]).toBe("00-principal.png");
  });

  it("ignora diferença de caixa", () => {
    const sorted = ["B.png", "a.png"].sort(compareMediaNames);
    expect(sorted).toEqual(["a.png", "B.png"]);
  });

  it("é determinístico", () => {
    const input = ["10.jpg", "2.jpg", "capa.jpg", "1.jpg"];
    expect([...input].sort(compareMediaNames)).toEqual([...input].sort(compareMediaNames));
  });
});
