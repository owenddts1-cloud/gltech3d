/**
 * Periodicidade do Dashboard. Puro e sem I/O — o servidor usa para consultar e
 * o cliente para rotular, sem os dois divergirem sobre onde a semana começa.
 */

export const PERIODS = ["semanal", "mensal", "trimestral", "semestral", "anual"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABEL: Record<Period, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value);
}

export interface PeriodWindow {
  /** Início do período atual (inclusivo). */
  start: Date;
  /** Início do período anterior — base da variação percentual. */
  prevStart: Date;
  /** Granularidade dos buckets dos gráficos. */
  bucket: "day" | "week" | "month";
  /** Quantos buckets o gráfico mostra. */
  bucketCount: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** Meia-noite local — datas de `financial_records` são `date`, sem hora. */
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/**
 * Janela do período, ancorada em `now`.
 *
 * Cada período tem a granularidade que faz o gráfico ser legível: 7 dias em
 * barras diárias é claro; 12 meses em barras diárias vira serragem.
 */
export function resolveWindow(period: Period, now: Date = new Date()): PeriodWindow {
  const today = startOfDay(now);

  switch (period) {
    case "semanal":
      return { start: addDays(today, -6), prevStart: addDays(today, -13), bucket: "day", bucketCount: 7 };
    case "mensal":
      return { start: addDays(today, -29), prevStart: addDays(today, -59), bucket: "day", bucketCount: 30 };
    case "trimestral":
      return { start: addDays(today, -89), prevStart: addDays(today, -179), bucket: "week", bucketCount: 13 };
    case "semestral":
      return { start: addMonths(today, -5), prevStart: addMonths(today, -11), bucket: "month", bucketCount: 6 };
    case "anual":
      return { start: addMonths(today, -11), prevStart: addMonths(today, -23), bucket: "month", bucketCount: 12 };
  }
}

/** Chave do bucket a que uma data pertence, na granularidade dada. */
export function bucketKey(date: Date, bucket: PeriodWindow["bucket"]): string {
  const d = startOfDay(date);
  if (bucket === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (bucket === "week") {
    // Segunda-feira da semana. getDay(): 0=domingo → recua 6; senão recua day-1.
    const day = d.getDay();
    const monday = addDays(d, day === 0 ? -6 : 1 - day);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Buckets do período, em ordem, já rotulados e vazios. */
export function buildBuckets(w: PeriodWindow, now: Date = new Date()): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const today = startOfDay(now);

  if (w.bucket === "month") {
    for (let i = w.bucketCount - 1; i >= 0; i--) {
      const d = addMonths(today, -i);
      out.push({
        key: bucketKey(d, "month"),
        label: MONTHS_SHORT[d.getMonth()] ?? "",
      });
    }
    return out;
  }

  if (w.bucket === "week") {
    for (let i = w.bucketCount - 1; i >= 0; i--) {
      const d = addDays(today, -i * 7);
      const key = bucketKey(d, "week");
      const monday = new Date(key);
      out.push({ key, label: `${monday.getDate()}/${monday.getMonth() + 1}` });
    }
    return out;
  }

  for (let i = w.bucketCount - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    out.push({
      key: bucketKey(d, "day"),
      // Em 30 dias, rotular todo dia polui: só a cada 3.
      label: w.bucketCount > 10 && i % 3 !== 0 ? "" : `${d.getDate()}/${d.getMonth() + 1}`,
    });
  }
  return out;
}

/** Variação percentual entre período atual e anterior. Null quando não há base. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
