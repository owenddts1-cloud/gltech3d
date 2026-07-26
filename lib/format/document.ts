/**
 * Máscaras de exibição dos documentos impressos.
 *
 * Todas são tolerantes: recebem o que estiver no cadastro (com ou sem máscara,
 * completo ou pela metade) e devolvem a melhor representação possível — nunca
 * lançam, nunca devolvem `undefined`. Documento impresso não pode quebrar porque
 * o CEP veio com 7 dígitos.
 */

export interface DocAddress {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
}

const digits = (v: string) => v.replace(/\D/g, "");

/** CPF (11) → `000.000.000-00`; CNPJ (14) → `00.000.000/0000-00`; resto sai como veio. */
export function maskCpfCnpj(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = digits(raw);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return raw.trim();
}

/** `"CPF"` ou `"CNPJ"` conforme o tamanho — o rótulo impresso ao lado do número. */
export function cpfCnpjLabel(raw: string | null | undefined): string {
  const d = digits(raw ?? "");
  if (d.length === 14) return "CNPJ";
  if (d.length === 11) return "CPF";
  return "Documento";
}

/** `32450000` → `32450-000`. */
export function maskCep(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = digits(raw);
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return raw.trim();
}

/** Telefone BR com 10 ou 11 dígitos, tolerando o `+55` do E.164 usado em `contacts`. */
export function maskPhoneBr(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = digits(raw);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw.trim();
}

/**
 * Endereço em uma linha, pulando o que estiver vazio:
 * `"Rua X, 20, sala 2 — Centro, Sarzedo-MG, CEP 32450-000"`.
 */
export function formatAddressLine(addr: DocAddress | null | undefined): string {
  if (!addr) return "";
  const clean = (v: string | null | undefined) => (v ?? "").trim();

  const streetParts = [clean(addr.street), clean(addr.number), clean(addr.complement)].filter(Boolean);
  const cityState = [clean(addr.city), clean(addr.state).toUpperCase()].filter(Boolean).join("-");
  const cep = maskCep(addr.cep);

  const tail = [clean(addr.district), cityState, cep ? `CEP ${cep}` : ""].filter(Boolean).join(", ");
  const head = streetParts.join(", ");

  if (head && tail) return `${head} — ${tail}`;
  return head || tail;
}

/** `true` quando não há nada de endereço para imprimir (esconde o bloco inteiro). */
export function isAddressEmpty(addr: DocAddress | null | undefined): boolean {
  return formatAddressLine(addr).length === 0;
}

/** Data ISO ou `YYYY-MM-DD` → `26/07/2026`. Entrada inválida vira string vazia. */
export function formatDateBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

/** `"Sarzedo, 26 de julho de 2026"` — a linha de local e data acima da assinatura. */
export function formatCityDateBr(city: string | null | undefined, iso: string | null | undefined): string {
  if (!iso) return (city ?? "").trim();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return (city ?? "").trim();
  const long = `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]!} de ${d.getUTCFullYear()}`;
  const c = (city ?? "").trim();
  return c ? `${c}, ${long}` : long;
}

/** Soma dias a uma data ISO e devolve `YYYY-MM-DD` — usado na validade da proposta. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
