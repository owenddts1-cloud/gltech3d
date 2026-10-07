/**
 * Paths that bypass auth check in middleware.
 * Match precedence: array order. First match wins.
 */
export const PUBLIC_PATHS: RegExp[] = [
  /^\/$/,
  /^\/product\/.+$/,
  /^\/produtos(\/.*)?$/,
  /^\/catalogo(\/.*)?$/,
  // Catálogo público de filamentos (0087) e a página de cada filamento. O
  // carrinho posta em /api/v1/public/filament-orders (já coberto abaixo).
  /^\/filamentos(\/.*)?$/,
  /^\/orcamento(\/.*)?$/,
  /^\/tecnologias(\/.*)?$/,
  /^\/calc3d-pro(\/.*)?$/,
  /^\/criar-conta$/,
  // Quem abre estas duas NAO consegue entrar — e esse e o ponto. A credencial e
  // o token assinado no caminho; exigir sessao aqui tornaria a recuperacao de
  // conta impossivel.
  /^\/esqueci-senha$/,
  /^\/redefinir-senha(\/.*)?$/,
  // Ativação do comprador do Calc3D PRO: ele ainda NÃO tem conta quando abre
  // este link — exigir sessão aqui tornaria a ativação impossível. O token
  // assinado no caminho é a credencial. Mesmo desenho de /team/accept-invite.
  /^\/ativar\/.+$/,
  // Aprovação/recusa de pedido PRO em 1 clique pelo e-mail do dono (sem login,
  // decisão do dono). O GET só exibe o resumo; quem decide é o POST em
  // /api/v1/public/pro-signup/email-action, com o token assinado como credencial.
  /^\/aprovar\/.+$/,
  /^\/privacidade(\/.*)?$/,
  /^\/termos(\/.*)?$/,
  /^\/login(\/.*)?$/,
  /^\/403$/,
  /^\/admin\/forbidden$/,
  /^\/404$/,
  /^\/500$/,
  /^\/503$/,
  // Liveness para monitor externo. Sem esta linha o middleware devolve 401 e
  // UptimeRobot/Better Stack não conseguem sequer perguntar se o site está de pé.
  /^\/api\/health$/,
  /^\/api\/v1\/health$/,
  /^\/manifest\.webmanifest$/,
  /^\/api\/v1\/public\//,
  /^\/api\/v1\/webhooks\//,
  /^\/api\/v1\/cron\//,
  /^\/api\/internal\//,
  // Túnel do Sentry (next.config.ts → tunnelRoute). O browser faz POST aqui para
  // driblar ad-blocker. Sem estar liberado, o middleware manda para /login, o
  // Next lê um POST numa rota de página como Server Action inválida e a tela
  // estoura com "An unexpected response was received from the server".
  /^\/monitoring/,
  /^\/api\/mcp(\/.*)?$/,
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/team\/accept-invite\/.+$/,
  /^\/account-suspended$/,
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}
