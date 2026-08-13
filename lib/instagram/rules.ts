/**
 * Motor de regras da automação — qual regra casa com qual evento.
 *
 * MÓDULO PURO: sem rede, sem banco. É onde a decisão acontece, e é o que dá para
 * testar sem app na Meta. O worker só executa o que este arquivo decidiu.
 *
 * A ARMADILHA QUE ISTO EVITA. "Palavra-chave" parece trivial até o primeiro caso
 * real: o cliente escreve "PREÇO" com acento, "preco" sem, "Quanto é o PREÇO?"
 * no meio da frase, ou "PREÇOS" no plural. E a regra de "STL" não pode casar com
 * "instalação", que contém as três letras em sequência. Comparar substring cru
 * erra dos dois lados — deixa venda passar e responde onde não devia.
 */

export interface AutomationRule {
  id: string;
  triggerType: "comment" | "dm_welcome" | "story_mention" | "dm_keyword";
  /** Vazio = vale para qualquer publicação. */
  mediaId: string | null;
  keywords: string[];
  priority: number;
  isActive: boolean;
}

export interface RuleMatchInput {
  kind: "comment" | "message" | "story_mention";
  text: string | null;
  mediaId: string | null;
  /** É a primeira mensagem desta conversa? Decide `dm_welcome`. */
  isFirstMessage?: boolean;
}

/** Tira acento e caixa. "PREÇOS" e "precos" viram a mesma coisa. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * A palavra aparece como PALAVRA, não como pedaço de outra?
 *
 * `"stl"` tem de casar com `"quero o STL"` e com `"STL?"`, mas NÃO com
 * `"instalação"`. A fronteira é checada à mão porque `\b` do JavaScript não
 * entende acento — e a comparação acontece sobre o texto já sem acento, então
 * fronteira é qualquer coisa que não seja letra ou dígito.
 */
export function containsKeyword(text: string, keyword: string): boolean {
  const alvo = normalizeText(keyword).trim();
  if (!alvo) return false;

  const base = normalizeText(text);
  const ehLetra = (c: string | undefined) => c !== undefined && /[a-z0-9]/.test(c);

  let from = 0;
  for (;;) {
    const at = base.indexOf(alvo, from);
    if (at === -1) return false;

    const antes = base[at - 1];
    const depois = base[at + alvo.length];
    // Plural é aceito: "preços" casa com a chave "preco". Cobrir isso importa
    // porque ninguém escreve exatamente a palavra cadastrada.
    const depoisEhPluralS = depois === "s" && !ehLetra(base[at + alvo.length + 1]);

    if (!ehLetra(antes) && (!ehLetra(depois) || depoisEhPluralS)) return true;
    from = at + 1;
  }
}

/**
 * Escolhe a regra que responde a este evento.
 *
 * Ordem: só regras ativas, do tipo certo, do post certo, com palavra que casa —
 * e entre as candidatas, a de menor `priority`. **Uma só responde.** Deixar duas
 * dispararem manda duas DMs para o mesmo comentário, e o cliente vê o robô
 * falhando.
 */
export function matchRule(
  rules: readonly AutomationRule[],
  input: RuleMatchInput,
): AutomationRule | null {
  const tipoEsperado: AutomationRule["triggerType"][] =
    input.kind === "comment"
      ? ["comment"]
      : input.kind === "story_mention"
        ? ["story_mention"]
        : input.isFirstMessage
          ? ["dm_welcome", "dm_keyword"]
          : ["dm_keyword"];

  const candidatas = rules.filter((r) => {
    if (!r.isActive) return false;
    if (!tipoEsperado.includes(r.triggerType)) return false;

    // Regra presa a um post só responde naquele post.
    if (r.mediaId && r.mediaId !== input.mediaId) return false;

    // Boas-vindas dispensa palavra-chave: o gatilho é a conversa começar.
    if (r.triggerType === "dm_welcome") return r.keywords.length === 0 || matchesAny(r, input.text);

    // Sem palavra cadastrada, a regra vale para qualquer texto daquele tipo.
    if (r.keywords.length === 0) return true;

    return matchesAny(r, input.text);
  });

  if (candidatas.length === 0) return null;

  return [...candidatas].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  )[0]!;
}

function matchesAny(rule: AutomationRule, text: string | null): boolean {
  if (!text) return false;
  return rule.keywords.some((k) => containsKeyword(text, k));
}

/**
 * Substitui as variáveis do template.
 *
 * Variável desconhecida fica COMO ESTÁ, em vez de virar string vazia: uma DM
 * dizendo "Olá , seu pedido de " é pior que uma mostrando `{nome}` — a segunda
 * denuncia o erro de configuração, a primeira parece descaso.
 */
export function renderTemplate(template: string, vars: Record<string, string | null>): string {
  return template.replace(/\{(\w+)\}/g, (inteiro, chave: string) => {
    const valor = vars[chave];
    return valor === null || valor === undefined || valor === "" ? inteiro : valor;
  });
}
