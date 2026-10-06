/**
 * Guardas do upload público de /orcamento (rotas em
 * app/api/v1/public/orcamento/upload-slot) e drift com a migration 0085.
 *
 * O endpoint é público e emite slot de upload: o que impede virar hospedagem de
 * arquivo e path traversal é (1) o caminho gerado no servidor, com carimbo de
 * emissão, (2) a allowlist de extensão/MIME sem `application/octet-stream`,
 * (3) a janela de 2 h para emitir link e (4) a checagem de conteúdo no confirm
 * (tests/unit/orcamento-file-check.test.ts).
 */
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ORCAMENTO_BUCKET,
  ORCAMENTO_MAX_BYTES,
  ORCAMENTO_MIME_TYPES,
  ORCAMENTO_PATH_RE,
  buildSlotPath,
  formatIssuedAt,
  isSlotFresh,
  orcamentoConfirmSchema,
  orcamentoKindOf,
  orcamentoUploadSlotSchema,
  parseIssuedAt,
  resolveOrcamentoContentType,
  safeOrcamentoFilename,
} from "@/lib/schemas/orcamento-upload";

const ROOT = path.resolve(__dirname, "../..");
const MIGRATION = readFileSync(
  path.join(ROOT, "supabase/migrations/20261007130000_0085_orcamentos_bucket.sql"),
  "utf8",
);
const BASELINE = readFileSync(path.join(ROOT, "supabase/baseline.sql"), "utf8");
const baselineBlock = (() => {
  const start = BASELINE.indexOf("(migration 0085) ----");
  const next = BASELINE.indexOf("\n-- ---- ", start + 10);
  return next === -1 ? BASELINE.slice(start) : BASELINE.slice(start, next);
})();

const NOW = new Date(Date.UTC(2026, 9, 7, 12, 30));

describe("slot de upload: Zod", () => {
  it("aceita o corpo esperado, com contentType vazio", () => {
    const r = orcamentoUploadSlotSchema.safeParse({ filename: "peca.stl", contentType: "", sizeBytes: 1000 });
    expect(r.success).toBe(true);
  });

  it("recusa arquivo acima de 50 MB", () => {
    const r = orcamentoUploadSlotSchema.safeParse({ filename: "a.stl", sizeBytes: ORCAMENTO_MAX_BYTES + 1 });
    expect(r.success).toBe(false);
  });

  it("recusa chave desconhecida (o caminho NUNCA vem do corpo)", () => {
    const r = orcamentoUploadSlotSchema.safeParse({ filename: "a.stl", sizeBytes: 10, path: "../x" });
    expect(r.success).toBe(false);
  });
});

describe("MIME resolvido pela extensão", () => {
  it("deriva um MIME explícito quando o navegador manda vazio", () => {
    expect(resolveOrcamentoContentType("Peca.STL", "")).toBe("model/stl");
    expect(resolveOrcamentoContentType("a.3mf", "")).toBe("model/3mf");
    expect(resolveOrcamentoContentType("a.stp", "")).toBe("model/step");
    expect(resolveOrcamentoContentType("a.obj", "")).toBe("model/obj");
  });

  it("mantém o MIME declarado só se ele vale PARA aquela extensão", () => {
    expect(resolveOrcamentoContentType("a.stl", "application/vnd.ms-pki.stl")).toBe("application/vnd.ms-pki.stl");
    expect(resolveOrcamentoContentType("a.stl", "image/png")).toBe("model/stl");
    expect(resolveOrcamentoContentType("a.stl", "application/octet-stream")).toBe("model/stl");
  });

  it("recusa extensão fora da allowlist, mesmo com MIME aceito", () => {
    expect(resolveOrcamentoContentType("a.exe", "model/stl")).toBeNull();
    expect(resolveOrcamentoContentType("a.html", "image/png")).toBeNull();
    expect(resolveOrcamentoContentType("semextensao", "model/stl")).toBeNull();
  });

  it("nunca resolve para application/octet-stream", () => {
    expect(ORCAMENTO_MIME_TYPES as readonly string[]).not.toContain("application/octet-stream");
  });
});

describe("caminho gerado no servidor", () => {
  it("o nome saneado nunca escapa da pasta", () => {
    for (const raw of ["../../etc/passwd.stl", "..\\..\\x.stl", "/abs/path.stl", ".hidden.stl", "peça final (v2).stl"]) {
      const p = buildSlotPath(raw, randomUUID(), NOW);
      expect(p).toMatch(ORCAMENTO_PATH_RE);
      const name = p.split("/")[1]!;
      expect(name.startsWith(".")).toBe(false);
      expect(name).not.toContain("\\");
    }
  });

  it("truncar nome longo preserva a extensão (o confirm decide o tipo por ela)", () => {
    const safe = safeOrcamentoFilename(`${"a".repeat(300)}.stl`);
    expect(safe.length).toBeLessThanOrEqual(120);
    expect(orcamentoKindOf(safe)).toBe("stl");
  });

  it("o carimbo de emissão vai e volta em UTC", () => {
    expect(formatIssuedAt(NOW)).toBe("202610071230");
    expect(parseIssuedAt(buildSlotPath("a.stl", randomUUID(), NOW))?.toISOString()).toBe(NOW.toISOString());
  });

  it("carimbo com data impossível é recusado", () => {
    expect(parseIssuedAt(`202613401230-${randomUUID()}/a.stl`)).toBeNull();
  });

  it("confirm aceita só <carimbo>-<uuid v4>/<nome saneado>", () => {
    const good = buildSlotPath("peca.stl", randomUUID(), NOW);
    expect(orcamentoConfirmSchema.safeParse({ path: good }).success).toBe(true);
    for (const bad of [
      "peca.stl",
      `${randomUUID()}/peca.stl`,
      `202610071230-${randomUUID()}/../outro/peca.stl`,
      `202610071230-${randomUUID()}/sub/peca.stl`,
      `pro-receipts/${randomUUID()}/x.pdf`,
      `202610071230-${randomUUID()}/.env`,
      "",
    ]) {
      expect(orcamentoConfirmSchema.safeParse({ path: bad }).success, bad).toBe(false);
    }
  });
});

describe("janela de 2 h para emitir link", () => {
  const p = buildSlotPath("a.stl", randomUUID(), NOW);
  const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

  it("aceita logo depois e até 2 h depois", () => {
    expect(isSlotFresh(p, at(0))).toBe(true);
    expect(isSlotFresh(p, at(119))).toBe(true);
  });

  it("recusa depois de 2 h", () => {
    expect(isSlotFresh(p, at(122))).toBe(false);
    expect(isSlotFresh(p, at(60 * 24 * 30))).toBe(false);
  });

  it("recusa carimbo no futuro além da tolerância de relógio", () => {
    expect(isSlotFresh(p, at(-10))).toBe(false);
    expect(isSlotFresh(p, at(-2))).toBe(true);
  });

  it("recusa caminho sem carimbo", () => {
    expect(isSlotFresh(`${randomUUID()}/a.stl`, NOW)).toBe(false);
  });
});

describe("drift com a migration 0085", () => {
  it.each([
    ["migration 0085", MIGRATION],
    ["apendice do baseline", baselineBlock],
  ])("%s cria o bucket privado com o mesmo limite e a mesma lista de MIME", (_label, sql) => {
    expect(sql).toContain(`('${ORCAMENTO_BUCKET}', '${ORCAMENTO_BUCKET}', false, ${ORCAMENTO_MAX_BYTES}`);
    for (const mime of ORCAMENTO_MIME_TYPES) {
      expect(sql).toContain(`'${mime}'`);
    }
    expect(sql).not.toContain("'application/octet-stream'");
    expect(sql).toContain("platform_admin_read_orcamentos");
  });
});
