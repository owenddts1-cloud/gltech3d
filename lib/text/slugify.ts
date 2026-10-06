/**
 * Converte um nome em slug de tenant (`[a-z0-9-]`, até 40 chars).
 *
 * Vivia privado no formulário de criação de tenant. Foi extraído quando a
 * aprovação de pedidos do Calc3D PRO passou a precisar sugerir o mesmo slug:
 * duas cópias divergiriam no primeiro ajuste de regra e o operador veria uma
 * sugestão no formulário e outra na tela de aprovação.
 */

// Marcas diacríticas combinantes (acentos soltos depois do NFD). Escrito como
// string escapada para o arquivo-fonte permanecer ASCII puro.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export const SLUG_MAX_LENGTH = 40;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH);
}
