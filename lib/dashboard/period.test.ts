import { describe, it, expect } from "vitest";
import { resolveWindow, bucketKey, buildBuckets, pctChange } from "./period";

/**
 * A janela e os buckets governam TODO número do Dashboard. Um erro de off-by-one
 * aqui não quebra a tela — ela só mostra o valor errado com cara de certo, que é
 * pior. Ancorado numa data fixa para o teste não depender de "hoje".
 */
const NOW = new Date(2026, 6, 16); // 16/jul/2026, quinta-feira

describe("resolveWindow", () => {
  it("semanal cobre 7 dias em buckets diários", () => {
    const w = resolveWindow("semanal", NOW);
    expect(w.bucket).toBe("day");
    expect(w.bucketCount).toBe(7);
    expect(w.start).toEqual(new Date(2026, 6, 10));
  });

  it("anual cobre 12 meses em buckets mensais", () => {
    const w = resolveWindow("anual", NOW);
    expect(w.bucket).toBe("month");
    expect(w.bucketCount).toBe(12);
    expect(w.start.getFullYear()).toBe(2025);
    expect(w.start.getMonth()).toBe(7); // agosto/2025
  });

  it("o período anterior tem a mesma duração do atual", () => {
    const w = resolveWindow("semanal", NOW);
    const atual = w.start.getTime() - w.prevStart.getTime();
    expect(atual).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("bucketKey", () => {
  it("agrupa por mês", () => {
    expect(bucketKey(new Date(2026, 6, 1), "month")).toBe("2026-07");
    expect(bucketKey(new Date(2026, 6, 31), "month")).toBe("2026-07");
  });

  it("joga a semana para a segunda-feira", () => {
    // 16/jul/2026 é quinta; a segunda é dia 13.
    expect(bucketKey(new Date(2026, 6, 16), "week")).toBe("2026-07-13");
    expect(bucketKey(new Date(2026, 6, 13), "week")).toBe("2026-07-13");
  });

  it("domingo pertence à semana que começou na segunda anterior, não na seguinte", () => {
    // 19/jul/2026 é domingo → segunda de 13/jul. É o off-by-one clássico.
    expect(bucketKey(new Date(2026, 6, 19), "week")).toBe("2026-07-13");
    // 20/jul é segunda → começa semana nova.
    expect(bucketKey(new Date(2026, 6, 20), "week")).toBe("2026-07-20");
  });
});

describe("buildBuckets", () => {
  it("devolve a quantidade certa, em ordem cronológica, terminando em hoje", () => {
    const w = resolveWindow("semanal", NOW);
    const b = buildBuckets(w, NOW);
    expect(b).toHaveLength(7);
    expect(b[0]?.key).toBe("2026-07-10");
    expect(b[6]?.key).toBe("2026-07-16");
  });

  it("anual devolve 12 meses sem repetir chave", () => {
    const b = buildBuckets(resolveWindow("anual", NOW), NOW);
    expect(b).toHaveLength(12);
    expect(new Set(b.map((x) => x.key)).size).toBe(12);
    expect(b[11]?.key).toBe("2026-07");
  });

  it("toda chave de bucket casa com o bucketKey de uma data dentro dele", () => {
    const w = resolveWindow("mensal", NOW);
    const keys = new Set(buildBuckets(w, NOW).map((b) => b.key));
    // Uma transação de hoje precisa cair num bucket existente, senão some do gráfico.
    expect(keys.has(bucketKey(NOW, w.bucket))).toBe(true);
  });
});

describe("pctChange", () => {
  it("calcula alta e queda", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
  });

  it("sem base anterior devolve null em vez de Infinity", () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(0, 0)).toBe(0);
  });
});
