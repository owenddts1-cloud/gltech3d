import { afterEach, describe, expect, it } from "vitest";

import { absoluteSiteUrl, siteUrl } from "./site-url";

const original = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = original;
});

const set = (v: string | undefined) => {
  if (v === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = v;
};

describe("siteUrl", () => {
  it("usa a variável quando ela é uma URL https de verdade", () => {
    set("https://gltech3d.com.br");
    expect(siteUrl()).toBe("https://gltech3d.com.br");
  });

  it("tira a barra do fim, para não gerar // ao concatenar", () => {
    set("https://exemplo.com/");
    expect(siteUrl()).toBe("https://exemplo.com");
  });

  it("NUNCA deixa localhost vazar", () => {
    // Um sitemap ou um feed da Meta com `localhost` publica endereço que só
    // abre na máquina do desenvolvedor — pior que domínio errado.
    for (const v of ["http://localhost:3000", "https://localhost:3000", "https://127.0.0.1:3000"]) {
      set(v);
      expect(siteUrl()).toBe("https://gltech3d.vercel.app");
    }
  });

  it("recusa http simples", () => {
    set("http://exemplo.com");
    expect(siteUrl()).toBe("https://gltech3d.vercel.app");
  });

  it("cai no padrão quando a variável falta ou está vazia", () => {
    set(undefined);
    expect(siteUrl()).toBe("https://gltech3d.vercel.app");
    set("   ");
    expect(siteUrl()).toBe("https://gltech3d.vercel.app");
  });
});

describe("absoluteSiteUrl", () => {
  it("junta caminho com e sem barra inicial", () => {
    set("https://exemplo.com");
    expect(absoluteSiteUrl("/produto/x")).toBe("https://exemplo.com/produto/x");
    expect(absoluteSiteUrl("produto/x")).toBe("https://exemplo.com/produto/x");
  });

  it("devolve URL já absoluta intacta", () => {
    set("https://exemplo.com");
    expect(absoluteSiteUrl("https://cdn.outro.com/a.png")).toBe("https://cdn.outro.com/a.png");
  });

  it("nunca gera barra dupla", () => {
    set("https://exemplo.com/");
    expect(absoluteSiteUrl("/a")).toBe("https://exemplo.com/a");
  });
});
