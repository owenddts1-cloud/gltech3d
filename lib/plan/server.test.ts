/**
 * `nextExpiry` e `planStateFromRow` sao as duas partes de `server.ts` que dao
 * para testar sem banco — e sao justamente onde o erro caro mora.
 *
 * O erro caro: renovar RESETANDO em vez de somar. Quem renova 10 dias antes do
 * vencimento perde esses 10 dias, e o sintoma so aparece um ano depois.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantProAccess, nextExpiry, planStateFromRow } from "./server";

const NOW = new Date("2026-10-05T12:00:00.000Z");
const DIA = 86_400_000;

describe("nextExpiry — renovação soma, não reseta", () => {
  it("sem data anterior conta a partir de agora", () => {
    const out = nextExpiry(null, 365, NOW);
    expect(Date.parse(out)).toBe(NOW.getTime() + 365 * DIA);
  });

  it("renovar 10 dias antes do vencimento PRESERVA os 10 dias restantes", () => {
    const vence = new Date(NOW.getTime() + 10 * DIA).toISOString();
    const out = nextExpiry(vence, 365, NOW);
    expect(Date.parse(out)).toBe(NOW.getTime() + 375 * DIA);
  });

  it("renovar depois de ja ter vencido conta a partir de agora, nao do passado", () => {
    const venceu = new Date(NOW.getTime() - 30 * DIA).toISOString();
    const out = nextExpiry(venceu, 365, NOW);
    expect(Date.parse(out)).toBe(NOW.getTime() + 365 * DIA);
  });

  it("data anterior corrompida nao propaga NaN", () => {
    const out = nextExpiry("nao-e-data", 365, NOW);
    expect(Number.isNaN(Date.parse(out))).toBe(false);
    expect(Date.parse(out)).toBe(NOW.getTime() + 365 * DIA);
  });

  it("duas renovacoes seguidas acumulam", () => {
    const primeira = nextExpiry(null, 365, NOW);
    const segunda = nextExpiry(primeira, 365, NOW);
    expect(Date.parse(segunda)).toBe(NOW.getTime() + 730 * DIA);
  });
});

describe("planStateFromRow", () => {
  it("devolve null quando nao ha linha", () => {
    expect(planStateFromRow(null)).toBeNull();
    expect(planStateFromRow(undefined)).toBeNull();
  });

  it("mapeia o snake_case do banco para o estado derivado", () => {
    const s = planStateFromRow({
      plan: "pro",
      trial_ends_at: null,
      plan_expires_at: new Date(Date.now() + 30 * DIA).toISOString(),
    });
    expect(s?.tier).toBe("pro");
    expect(s?.hasProAccess).toBe(true);
  });

  it("org pro sem data de expiracao continua com acesso", () => {
    const s = planStateFromRow({ plan: "pro", trial_ends_at: null, plan_expires_at: null });
    expect(s?.hasProAccess).toBe(true);
    expect(s?.status).toBe("active");
  });
});

describe("grantProAccess", () => {
  function fakeClient(
    current: { plan?: string; plan_expires_at: string | null } | null,
    updatedRows: unknown[],
  ) {
    const writes: Record<string, unknown>[] = [];
    const client = {
      from() {
        const b = {
          select: () => b,
          eq: () => b,
          maybeSingle: () => Promise.resolve({ data: current, error: null }),
          update: (row: Record<string, unknown>) => {
            writes.push(row);
            return {
              eq: () => ({ select: () => Promise.resolve({ data: updatedRows, error: null }) }),
            };
          },
        };
        return b;
      },
    } as unknown as SupabaseClient;
    return { client, writes };
  }

  it("grava só as colunas de plano — o settings.plan legado não é mais escrito", async () => {
    const { client, writes } = fakeClient({ plan_expires_at: null }, [{ id: "org-1" }]);
    const res = await grantProAccess(client, "org-1", 365);
    expect(res.ok).toBe(true);
    expect(writes).toHaveLength(1);
    expect(Object.keys(writes[0] ?? {}).sort()).toEqual(["plan", "plan_expires_at"]);
    expect(writes[0]?.plan).toBe("pro");
  });

  it("UPDATE que casa zero linhas é falha, não sucesso", async () => {
    const { client } = fakeClient({ plan_expires_at: null }, []);
    const res = await grantProAccess(client, "org-1", 365);
    expect(res.ok).toBe(false);
  });

  it.each(["pro", "enterprise"])(
    "plano %s SEM vencimento não é reduzido a 365 dias nem rebaixado",
    async (plan) => {
      const { client, writes } = fakeClient({ plan, plan_expires_at: null }, [{ id: "org-1" }]);
      const res = await grantProAccess(client, "org-1", 365);
      expect(res).toEqual({ ok: true, planExpiresAt: null });
      expect(writes).toHaveLength(0);
    },
  );

  it("enterprise COM vencimento continua enterprise e ganha o período", async () => {
    const vence = new Date(Date.now() + 10 * DIA).toISOString();
    const { client, writes } = fakeClient({ plan: "enterprise", plan_expires_at: vence }, [{ id: "org-1" }]);
    const res = await grantProAccess(client, "org-1", 365);
    expect(res.ok).toBe(true);
    expect(writes[0]?.plan).toBe("enterprise");
    expect(Date.parse(String(writes[0]?.plan_expires_at))).toBeGreaterThan(Date.parse(vence));
  });
});
