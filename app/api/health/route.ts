import { NextResponse } from "next/server";

/**
 * Liveness — "o app está servindo?".
 *
 * POR QUE ISTO EXISTE, separado de `/api/v1/health`. Aquele endpoint é um
 * diagnóstico PROFUNDO: consulta Supabase, Redis, WAHA e Resend, e devolve 503
 * quando qualquer um está fora. Medido em produção em 11/08/2026:
 *
 *   supabase ok · redis degraded · waha DOWN (fetch failed) · resend degraded
 *
 * O 503 dali é honesto — o WAHA está mesmo inacessível. Mas monitor externo
 * (UptimeRobot, Better Stack) usa o endpoint para responder OUTRA pergunta: "o
 * site caiu?". Com os dois papéis no mesmo lugar, o monitor dispara alerta de
 * madrugada porque o WhatsApp está fora, enquanto a loja atende normalmente — e
 * alerta que toca sem o site estar fora é alerta que passa a ser ignorado.
 *
 * Este aqui não toca em NADA externo de propósito. Se o processo consegue
 * responder, o app está de pé. É a única coisa que ele afirma.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "gltech3d",
      timestamp: new Date().toISOString(),
      // Aponta para o diagnóstico profundo, para quem chegou aqui procurando
      // estado de integração não sair achando que "ok" cobre tudo.
      dependencies: "/api/v1/health",
    },
    {
      status: 200,
      headers: {
        // Monitor consulta a cada minuto; resposta cacheada mentiria sobre o
        // estado atual e esconderia justamente a queda que ele procura.
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

/** Alguns monitores usam HEAD para gastar menos banda. */
export function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
