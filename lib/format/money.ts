/**
 * Formatação de dinheiro — módulo canônico.
 *
 * `brlFromCents` é a forma padrão: o banco guarda tudo em `*_cents` inteiros.
 * `brlFromReais` existe para a parte do sistema que calcula em reais (motor de
 * precificação, planilha do Controle, projetos). Ter as duas nomeadas evita o
 * erro de dividir por 100 duas vezes — ou nenhuma.
 *
 * O que ainda formata por conta própria, e por quê (não é esquecimento):
 *
 * - `components/kanban/KanbanCard.tsx` e `components/inbox/CRMSidePanel.tsx`
 *   respeitam a moeda da linha (`currency` da tabela), não só BRL.
 * - `components/kanban/StageColumn.tsx` e os gráficos usam
 *   `maximumFractionDigits: 0` para caber no eixo.
 * - `app/app/control/_components/SpreadsheetGrid.tsx` devolve string vazia em
 *   valor nulo ou zero, porque célula de planilha vazia não mostra "R$ 0,00".
 * - Os módulos de IA e o e-mail de alarme instanciam o formatter uma vez e
 *   chamam `.format()` em vários pontos.
 *
 * Unificar esses casos exigiria parametrizar o módulo (moeda, casas decimais,
 * comportamento em zero) — o que troca duplicação por uma função com quatro
 * flags. Fica como está, documentado.
 */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `125000` → `"R$ 1.250,00"`. Entrada em centavos (a convenção do banco). */
export function brlFromCents(cents: number): string {
  return BRL.format((Number.isFinite(cents) ? cents : 0) / 100);
}

/**
 * `1250` → `"R$ 1.250,00"`. Entrada já em reais.
 *
 * Existe porque parte do sistema calcula em reais e não em centavos — o motor de
 * precificação (`lib/pricing/engine`), a planilha do Controle e os projetos. Ter
 * as duas funções nomeadas evita o erro clássico de dividir por 100 duas vezes,
 * ou nenhuma.
 */
export function brlFromReais(value: number): string {
  return BRL.format(Number.isFinite(value) ? value : 0);
}

/** Só o número, sem o símbolo: `125000` → `"1.250,00"`. Útil dentro de tabelas. */
export function brlNumberFromCents(cents: number): string {
  return ((Number.isFinite(cents) ? cents : 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * `"1.250,00"` / `"1250.00"` / `"1250"` → `125000`.
 *
 * Aceita o que o usuário digita de verdade. A regra: se houver vírgula, ela é o
 * separador decimal e os pontos são de milhar; se não houver vírgula, um único
 * ponto seguido de 1-2 dígitos é decimal, e qualquer outro ponto é milhar.
 */
export function centsFromInput(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;

  const negative = /^-/.test(s);
  const digitsAndSeps = s.replace(/[^\d.,]/g, "");
  if (!digitsAndSeps) return 0;

  let normalized: string;
  if (digitsAndSeps.includes(",")) {
    normalized = digitsAndSeps.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{1,2}$/.test(digitsAndSeps) && digitsAndSeps.split(".").length === 2) {
    normalized = digitsAndSeps;
  } else {
    normalized = digitsAndSeps.replace(/\./g, "");
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) * (negative ? -1 : 1);
}

const UNITS = [
  "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete",
  "dezoito", "dezenove",
] as const;
const TENS = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
  "oitenta", "noventa",
] as const;
const HUNDREDS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
] as const;

/** Escreve um grupo de 1 a 999. */
function groupToWords(n: number): string {
  if (n === 100) return "cem";
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) parts.push(HUNDREDS[h]!);
  if (rest > 0) {
    if (rest < 20) parts.push(UNITS[rest]!);
    else {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      parts.push(u > 0 ? `${TENS[t]!} e ${UNITS[u]!}` : TENS[t]!);
    }
  }
  return parts.join(" e ");
}

const SCALES: ReadonlyArray<readonly [singular: string, plural: string]> = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "milhões"],
  ["bilhão", "bilhões"],
  ["trilhão", "trilhões"],
];

/** Escreve um inteiro não-negativo por extenso, sem unidade monetária. */
function intToWords(value: number): string {
  if (value === 0) return "zero";

  const groups: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  if (groups.length > SCALES.length) return String(value);

  // Cada pedaço guarda o valor do próprio grupo, porque o conector até ele depende
  // desse valor: em português o "e" entra quando o grupo seguinte é menor que 100
  // ou é uma centena redonda — "mil e duzentos", "dois milhões e quinhentos mil",
  // mas "mil duzentos e trinta".
  const chunks: Array<{ text: string; group: number }> = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!;
    if (g === 0) continue;
    const scale = SCALES[i]!;
    if (i === 0) chunks.push({ text: groupToWords(g), group: g });
    else if (i === 1 && g === 1) chunks.push({ text: "mil", group: g });
    else chunks.push({ text: `${groupToWords(g)} ${g === 1 ? scale[0] : scale[1]}`, group: g });
  }

  return chunks.reduce((acc, chunk, index) => {
    if (index === 0) return chunk.text;
    const joiner = chunk.group < 100 || chunk.group % 100 === 0 ? " e " : " ";
    return `${acc}${joiner}${chunk.text}`;
  }, "");
}

/**
 * Valor por extenso para o recibo: `123450` → `"mil duzentos e trinta e quatro
 * reais e cinquenta centavos"`.
 *
 * Valor negativo não faz sentido num recibo; o sinal é ignorado e o módulo é
 * escrito (quem chama é responsável por não passar negativo).
 */
export function centsToWordsPtBr(cents: number): string {
  const total = Math.abs(Math.round(Number.isFinite(cents) ? cents : 0));
  const reais = Math.floor(total / 100);
  const centavos = total % 100;

  // "dois milhões DE reais", mas "dois milhões e quinhentos mil reais": a
  // preposição só entra quando o número termina exatamente na escala.
  const exactScale = reais >= 1_000_000 && reais % 1_000_000 === 0;
  const unit = reais === 1 ? "real" : exactScale ? "de reais" : "reais";
  const reaisPart = reais > 0 ? `${intToWords(reais)} ${unit}` : "";
  const centavosPart =
    centavos > 0 ? `${intToWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}` : "";

  if (reaisPart && centavosPart) return `${reaisPart} e ${centavosPart}`;
  if (reaisPart) return reaisPart;
  if (centavosPart) return centavosPart;
  return "zero reais";
}

/**
 * Preço de produto da vitrine: faixa livre quando existe, valor formatado quando não.
 *
 * DEFEITO QUE ISTO CORRIGE. A landing tinha dois caminhos de formatação. O campo
 * `price_range` é texto livre que o operador digita ("12,90 - 74,90", com
 * vírgula), e o `price` numérico era renderizado com `toFixed(2)`, que devolve
 * ponto. Resultado publicado: **"R$ 44.90" ao lado de "R$ 12,90 - 74,90"**, na
 * mesma página — e o ponto também vazava para o `<title>` da página de produto,
 * que é o que aparece no Google.
 *
 * A faixa é devolvida como o operador escreveu, de propósito: normalizar texto
 * livre daria margem a mutilar um valor legítimo ("sob consulta", "a partir de
 * 30"). O que se padroniza é o caminho numérico.
 *
 * DEVOLVE SEM O "R$": os componentes da vitrine já escrevem o símbolo no JSX.
 * Uma versão com prefixo duplicaria em três lugares.
 */
export function priceLabelWithoutSymbol(price: number, priceRange?: string | null): string {
  const range = priceRange?.trim();
  if (range) return range;
  return brlNumberFromCents(Math.round((Number.isFinite(price) ? price : 0) * 100));
}
