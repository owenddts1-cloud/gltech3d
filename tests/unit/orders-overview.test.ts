import { describe, expect, it } from "vitest";
import {
  bucketOrders,
  paginate,
  slaLabel,
} from "@/app/app/dashboard/_lib/orders-overview";
import type { OrderOverviewRow } from "@/app/actions/dashboard/analytics";

const NOW = new Date("2026-07-18T12:00:00Z");

function row(partial: Partial<OrderOverviewRow> & { id: string }): OrderOverviewRow {
  return {
    code: null,
    title: "Peça",
    contactName: "Cliente",
    status: "aprovado",
    totalCents: 1000,
    slaDueAt: null,
    concludedAt: null,
    createdAt: "2026-07-01T00:00:00Z",
    ...partial,
  };
}

describe("bucketOrders", () => {
  it("classifica concluída / atrasada / andamento por status + prazo", () => {
    const b = bucketOrders(
      [
        row({ id: "done", status: "concluido", concludedAt: "2026-07-10T00:00:00Z" }),
        row({ id: "late", slaDueAt: "2026-07-15T00:00:00Z" }),
        row({ id: "ok", slaDueAt: "2026-07-25T00:00:00Z" }),
        row({ id: "nosla" }),
      ],
      NOW,
    );
    expect(b.concluidas.map((r) => r.id)).toEqual(["done"]);
    expect(b.atrasadas.map((r) => r.id)).toEqual(["late"]);
    expect(b.andamento.map((r) => r.id)).toEqual(["ok", "nosla"]);
  });

  it("O.S. concluída com SLA vencido NÃO conta como atrasada", () => {
    const b = bucketOrders(
      [row({ id: "x", status: "concluido", slaDueAt: "2026-07-01T00:00:00Z" })],
      NOW,
    );
    expect(b.atrasadas).toHaveLength(0);
    expect(b.concluidas).toHaveLength(1);
  });

  it("ordena atrasadas da mais vencida para a menos; concluídas da mais recente", () => {
    const b = bucketOrders(
      [
        row({ id: "l1", slaDueAt: "2026-07-17T00:00:00Z" }),
        row({ id: "l2", slaDueAt: "2026-07-10T00:00:00Z" }),
        row({ id: "c1", status: "concluido", concludedAt: "2026-07-05T00:00:00Z" }),
        row({ id: "c2", status: "concluido", concludedAt: "2026-07-16T00:00:00Z" }),
      ],
      NOW,
    );
    expect(b.atrasadas.map((r) => r.id)).toEqual(["l2", "l1"]);
    expect(b.concluidas.map((r) => r.id)).toEqual(["c2", "c1"]);
  });
});

describe("paginate", () => {
  const list = Array.from({ length: 12 }, (_, i) => i + 1);

  it("fatia 5 por página e calcula o total de páginas", () => {
    const p1 = paginate(list, 1);
    expect(p1.items).toEqual([1, 2, 3, 4, 5]);
    expect(p1.totalPages).toBe(3);
    expect(paginate(list, 3).items).toEqual([11, 12]);
  });

  it("clampa páginas fora do intervalo (0 e além do fim)", () => {
    expect(paginate(list, 0).page).toBe(1);
    expect(paginate(list, 99).page).toBe(3);
    expect(paginate([], 5).totalPages).toBe(1);
  });
});

describe("slaLabel", () => {
  it("atrasada em dias, vence hoje, vence em Xd e sem prazo", () => {
    expect(slaLabel("2026-07-15T12:00:00Z", NOW)).toEqual({ text: "3d atrasada", tone: "danger" });
    expect(slaLabel("2026-07-18T20:00:00Z", NOW)).toEqual({ text: "vence hoje", tone: "warning" });
    expect(slaLabel("2026-07-20T12:00:00Z", NOW)).toEqual({ text: "vence em 2d", tone: "warning" });
    expect(slaLabel("2026-07-30T12:00:00Z", NOW)).toEqual({ text: "vence em 12d", tone: "neutral" });
    expect(slaLabel(null, NOW)).toBeNull();
  });
});
