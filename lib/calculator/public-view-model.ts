/**
 * Derivações de apresentação da calculadora pública.
 *
 * Doutrina DIRC: "tempo total" e "só filamento" NÃO viram campos novos em
 * `CalculatorOutputs`. "Só filamento" já existe como `outputs.custoFilamento`
 * (Referenciar) e "tempo total" sai de dois inputs (Calcular). Acrescentá-los ao
 * contrato mudaria o que a tela autenticada e o `QuotePdfModal` leem, sem ganho.
 *
 * Funções puras, testáveis sem render.
 */

import type { CalculatorInputs, CalculatorOutputs } from '@/hooks/calculator/useCalculator';

/** Horas de máquina + mão de obra do lote inteiro. */
export function totalHours(i: CalculatorInputs): number {
  const perPiece = i.tempoImpressao + i.horasManuais;
  return Math.max(0, perPiece * Math.max(0, i.quantidade));
}

/** "1,0 h" / "12,5 h" — mesma unidade que o campo de entrada usa. */
export function formatHours(hours: number): string {
  return `${hours.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

/**
 * A frase de ROI do painel de resultado.
 *
 * `pecasParaPagar` vem como `Infinity` quando o lucro unitário é zero ou
 * negativo (useCalculator.ts). Imprimir "∞ peças" seria pior que inútil — nesse
 * caso a mensagem precisa dizer o que fazer.
 */
export function roiSentence(o: CalculatorOutputs): { text: string; healthy: boolean } {
  if (!Number.isFinite(o.pecasParaPagar) || o.lucroUnitario <= 0) {
    return {
      text: 'Nesta margem a peça não paga a máquina. Suba a margem ou reveja o custo.',
      healthy: false,
    };
  }
  const n = o.pecasParaPagar.toLocaleString('pt-BR');
  return { text: `Com esse lucro, cerca de ${n} peças pagam a máquina.`, healthy: true };
}

/** Participação de cada parcela no custo, já ordenada para o gráfico de barras. */
export function costAnatomy(o: CalculatorOutputs): ReadonlyArray<{
  key: string;
  label: string;
  value: number;
  pct: number;
}> {
  return [
    { key: 'filamento', label: 'Filamento', value: o.custoFilamento, pct: o.pctFilamento },
    { key: 'energia', label: 'Energia', value: o.custoEnergia, pct: o.pctEnergia },
    { key: 'maquina', label: 'Máquina', value: o.custoDepreciacao, pct: o.pctDepreciacao },
    { key: 'trabalho', label: 'Trabalho', value: o.custoTrabalho, pct: o.pctTrabalho },
    { key: 'falhas', label: 'Falhas', value: o.custoFalha, pct: o.pctFalha },
  ];
}

/**
 * Tom do slider de margem, na paleta marrom.
 *
 * O CRM usa vermelho/âmbar/verde; aqui essas cores destoariam do creme/bronze da
 * vitrine, então os três estados foram re-tonalizados mantendo a leitura
 * (terracota = apertado, bronze = ok, oliva = folgado).
 */
export function marginTone(marginPct: number): { bar: string; text: string } {
  if (marginPct < 40) return { bar: '#B4553F', text: 'text-[#B4553F]' };
  if (marginPct < 90) return { bar: '#A6815C', text: 'text-[#7A5C3E]' };
  return { bar: '#6F7F52', text: 'text-[#55663E]' };
}
