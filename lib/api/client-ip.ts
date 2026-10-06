import type { NextRequest } from "next/server";

/**
 * IP do cliente, para rate limit e auditoria em rotas públicas.
 *
 * Estava copiado em cada rota de `/api/v1/public/`. Com o auto-cadastro e o
 * reset de senha somando duas cópias novas, virou um lugar só — a divergência
 * que importaria aqui é silenciosa: uma rota lendo o header errado e aplicando
 * rate limit sobre `"unknown"` para todo mundo.
 *
 * ORDEM DE CONFIANÇA (o cliente controla tudo o que chega antes do proxy):
 *   1. `x-real-ip` — a Vercel o define com o IP da conexão, e o nginx do kit
 *      self-host (`proxy_set_header X-Real-IP $remote_addr`, ver
 *      docs/runbooks/waha-hostgator.md) também. O valor do cliente é sobrescrito.
 *   2. a ÚLTIMA entrada de `x-forwarded-for` — `$proxy_add_x_forwarded_for`
 *      ACRESCENTA o IP da conexão ao que o cliente mandou, então a primeira
 *      entrada é forjável (mandar `X-Forwarded-For: 1.2.3.4` a cada request
 *      zerava o rate limit). A última é a que o nosso proxy escreveu.
 *   3. `"unknown"`.
 */
export function clientIp(req: Pick<NextRequest, "headers">): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const last = xff
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .pop();
    if (last) return last;
  }
  return "unknown";
}
