import type { Metadata } from "next";
import Link from "next/link";

import { verifyEmailActionToken } from "@/lib/pro-signup/email-action-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/pricing/pro-plans";
import { logger } from "@/lib/logger";
import { EmailActionRunner } from "./_client";

export const metadata: Metadata = {
  title: "Pedido Calc3D PRO",
  // <meta name="robots" content="noindex, nofollow">
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

/** "maria@example.com" → "ma***@example.com". */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

function InvalidLink({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <Link href="/admin/pro-signups" className="mt-4 inline-block text-sm font-medium underline">
        Abrir a fila no painel
      </Link>
    </div>
  );
}

/**
 * Aprovação/recusa de pedido do Calc3D PRO pelo botão do e-mail do dono.
 *
 * Abrir esta página NÃO DECIDE NADA. O GET verifica o token (assinatura,
 * propósito, validade) só para mostrar o resumo; o componente cliente exibe um
 * botão "Confirmar…" e o POST sai apenas no clique — scanners de e-mail abrem o
 * link num navegador headless com JavaScript, então disparar ao carregar faria
 * o scanner aprovar ou recusar sozinho. O POST verifica tudo de novo.
 */
export default async function AprovarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verified = verifyEmailActionToken(token);

  if (!verified.ok) {
    if (verified.reason === "disabled") {
      return (
        <InvalidLink
          title="Aprovação pelo e-mail desativada"
          body="Decida o pedido pelo painel de administração."
        />
      );
    }
    return (
      <InvalidLink
        title={verified.reason === "expired" ? "Link expirado" : "Link inválido"}
        body={
          verified.reason === "expired"
            ? "Os botões do e-mail valem 48 horas. Decida o pedido pelo painel."
            : "Este link não é válido. Decida o pedido pelo painel."
        }
      />
    );
  }

  const { rid, act, amt } = verified.payload;

  // Leitura apenas, para o resumo. Falha aqui não impede a decisão — o POST
  // carrega o pedido de novo.
  let buyerName: string | null = null;
  let buyerEmail: string | null = null;
  const { data, error } = await createAdminClient()
    .from("pro_signup_requests")
    .select("buyer_name, buyer_email")
    .eq("id", rid)
    .maybeSingle();
  if (error) {
    logger.error("aprovar_page_summary_failed", { rid, details: error.message });
  } else if (data) {
    buyerName = data.buyer_name as string;
    buyerEmail = maskEmail(data.buyer_email as string);
  }

  return (
    <EmailActionRunner
      token={token}
      action={act}
      signupId={rid}
      amountLabel={formatBRL(amt)}
      buyerName={buyerName}
      buyerEmailMasked={buyerEmail}
    />
  );
}
