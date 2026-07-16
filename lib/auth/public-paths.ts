/**
 * Paths that bypass auth check in middleware.
 * Match precedence: array order. First match wins.
 */
export const PUBLIC_PATHS: RegExp[] = [
  /^\/$/,
  /^\/product\/.+$/,
  /^\/login(\/.*)?$/,
  /^\/403$/,
  /^\/admin\/forbidden$/,
  /^\/404$/,
  /^\/500$/,
  /^\/503$/,
  /^\/api\/v1\/health$/,
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
