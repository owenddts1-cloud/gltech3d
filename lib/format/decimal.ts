/**
 * Leitura de número digitado por humano em pt-BR.
 *
 * Existia como `.replace(",", ".")` copiado em seis pontos do formulário de
 * produtos. Espalhado assim, cada cópia falhava de um jeito: `"1.250,50"`
 * (separador de milhar) virava `NaN`, e campo vazio virava `NaN` em vez de 0.
 *
 * A regra é a mesma de `centsFromInput` em `lib/format/money.ts` — aquele
 * devolve centavos, este devolve o número em si (gramas, minutos, percentual).
 */
export function parseDecimal(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;

  const cleaned = s.replace(/[^\d.,-]/g, "");
  if (!cleaned) return 0;

  let normalized: string;
  if (cleaned.includes(",")) {
    // Vírgula presente = ela é o decimal, e os pontos são de milhar.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{1,2}$/.test(cleaned) && cleaned.split(".").length === 2) {
    normalized = cleaned; // "1250.50" — ponto decimal ao estilo inglês
  } else {
    normalized = cleaned.replace(/\./g, ""); // "1.250" é mil duzentos e cinquenta
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

/** Número → string de input em pt-BR. `0` vira `""` para não poluir o campo. */
export function formatDecimalInput(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value) || value === 0) return "";
  return value.toFixed(fractionDigits).replace(".", ",");
}
