import { describe, it, expect } from "vitest";
import { clearSeen, parseSeen, readSeen, storageKey, writeSeen, type GuideStorage } from "./storage";

function memoryStorage(): GuideStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

function brokenStorage(): GuideStorage {
  const fail = (): never => {
    throw new Error("SecurityError");
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

describe("storageKey", () => {
  it("é versionada e por usuário", () => {
    expect(storageKey("u1")).toBe("guides:v1:u1");
  });
});

describe("parseSeen", () => {
  it("aceita só arrays de strings não vazias", () => {
    expect(parseSeen('["a","b"]')).toEqual(["a", "b"]);
    expect(parseSeen('["a", 1, null, ""]')).toEqual(["a"]);
  });

  it("valor ausente, corrompido ou de outro formato vira lista vazia", () => {
    expect(parseSeen(null)).toEqual([]);
    expect(parseSeen("{not json")).toEqual([]);
    expect(parseSeen('{"a":1}')).toEqual([]);
    expect(parseSeen('"texto"')).toEqual([]);
  });
});

describe("readSeen / writeSeen / clearSeen", () => {
  it("grava e lê de volta os ids vistos do usuário", () => {
    const s = memoryStorage();
    expect(writeSeen("u1", ["dashboard", "welcome", "dashboard"], s)).toBe(true);
    expect(readSeen("u1", s)).toEqual(new Set(["dashboard", "welcome"]));
    // Outro usuário no mesmo navegador não herda o estado.
    expect(readSeen("u2", s)).toEqual(new Set());
  });

  it("clearSeen esquece tudo do usuário", () => {
    const s = memoryStorage();
    writeSeen("u1", ["a"], s);
    expect(clearSeen("u1", s)).toBe(true);
    expect(readSeen("u1", s)).toEqual(new Set());
  });

  it("storage indisponível: leitura devolve null e escrita devolve false, sem lançar", () => {
    expect(readSeen("u1", null)).toBeNull();
    expect(writeSeen("u1", ["a"], null)).toBe(false);
    expect(clearSeen("u1", null)).toBe(false);
  });

  it("storage que lança: nada propaga", () => {
    const s = brokenStorage();
    expect(readSeen("u1", s)).toBeNull();
    expect(writeSeen("u1", ["a"], s)).toBe(false);
    expect(clearSeen("u1", s)).toBe(false);
  });

  it("usa o localStorage do navegador por padrão", () => {
    window.localStorage.clear();
    expect(writeSeen("u-default", ["x"])).toBe(true);
    expect(window.localStorage.getItem("guides:v1:u-default")).toBe('["x"]');
    expect(readSeen("u-default")).toEqual(new Set(["x"]));
    window.localStorage.clear();
  });
});
