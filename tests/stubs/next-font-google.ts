/**
 * Stub de `next/font/google` para os testes.
 *
 * `next/font` é resolvido pelo transform do Next no build; fora dele o import
 * quebra. Os componentes só usam a propriedade `variable` (o nome da CSS var), e
 * é isso que o stub devolve — nome estável para não poluir snapshot de markup.
 *
 * Ligado por alias em `vitest.config.ts`.
 */
interface FontResult {
  variable: string;
  className: string;
  style: { fontFamily: string };
}

function makeFont(cssVarName: string) {
  return (options: { variable?: string } = {}): FontResult => ({
    variable: options.variable ? `__variable_${options.variable.replace(/^--/, "")}` : cssVarName,
    className: cssVarName,
    style: { fontFamily: cssVarName },
  });
}

export const Montserrat = makeFont("stub-montserrat");
export const Great_Vibes = makeFont("stub-great-vibes");
export const Atkinson_Hyperlegible = makeFont("stub-atkinson");
export const IBM_Plex_Mono = makeFont("stub-plex-mono");
export const Inter = makeFont("stub-inter");
export const Sora = makeFont("stub-sora");

/**
 * Qualquer outra família importada por um componente novo cai aqui em vez de
 * quebrar a suíte com "export não encontrado".
 */
const handler: ProxyHandler<Record<string, unknown>> = {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    return makeFont(`stub-${String(prop).toLowerCase()}`);
  },
};

export default new Proxy(
  { Montserrat, Great_Vibes, Atkinson_Hyperlegible, IBM_Plex_Mono, Inter, Sora } as Record<string, unknown>,
  handler,
);
