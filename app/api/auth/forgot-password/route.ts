import { POST as handlePasswordReset } from "@/app/api/v1/public/password-reset/route";
import type { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/forgot-password
 *
 * Endpoint oficial de solicitação de redefinição de senha para a aplicação.
 * Encaminha para o processador de redefinição com validação Zod, token HMAC (1h) e disparo de e-mail.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handlePasswordReset(req);
}
