import { POST as handleLeadSubmission } from "@/app/api/v1/public/leads/route";
import type { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/orcamento
 *
 * Endpoint público de solicitação de orçamento.
 * Valida dados, cria contato no CRM, dispara e-mail com layout de ficha técnica + link do WhatsApp
 * para a diretoria, e envia e-mail acolhedor de confirmação para o cliente.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleLeadSubmission(req);
}
