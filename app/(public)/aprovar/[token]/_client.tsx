"use client";
import { useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ManualActions } from "@/components/pro-signup/ManualActions";
import { CircleNotch } from "@/lib/ui/icons";
import {
  buyerMembershipWarning,
  type BuyerMembership,
} from "@/lib/pro-signup/buyer-membership";
import {
  buildActivationMessage,
  buildUpgradeMessage,
  buildWhatsappUrl,
} from "@/lib/pro-signup/whatsapp-message";

type Action = "approve" | "reject";

interface ApprovedCommon {
  organization_name: string;
  /** null = plano sem vencimento. */
  plan_expires_at: string | null;
  email_dispatched: boolean;
  buyer_name: string;
  buyer_phone: string | null;
}

interface ApprovedUpgrade extends ApprovedCommon {
  mode: "upgrade";
  buyer_membership: BuyerMembership | null;
}

interface ApprovedCreate extends ApprovedCommon {
  mode: "create";
  existing_account: boolean;
  activation_url: string | null;
  activation_expires_at: string | null;
}

type View =
  | { kind: "confirm" }
  | { kind: "running" }
  | { kind: "upgrade"; data: ApprovedUpgrade }
  | { kind: "create"; data: ApprovedCreate }
  | { kind: "rejected"; buyerName: string }
  | { kind: "already_decided" }
  | { kind: "ambiguous" }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "error"; message: string };

const MEMBERSHIPS: readonly BuyerMembership[] = [
  "active_kept",
  "revoked_not_reactivated",
  "missing_not_created",
  "no_account",
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** Turns the API envelope into a view. Anything unexpected becomes an error view. */
export function toView(status: number, json: unknown): View {
  const data = isRecord(json) && isRecord(json.data) ? json.data : null;
  if (status >= 200 && status < 300 && data) {
    if (data.action === "reject") return { kind: "rejected", buyerName: str(data.buyer_name) };
    const common: ApprovedCommon = {
      organization_name: str(data.organization_name),
      plan_expires_at: strOrNull(data.plan_expires_at),
      email_dispatched: data.email_dispatched === true,
      buyer_name: str(data.buyer_name),
      buyer_phone: strOrNull(data.buyer_phone),
    };
    if (data.mode === "upgrade") {
      const m = MEMBERSHIPS.find((x) => x === data.buyer_membership) ?? null;
      return { kind: "upgrade", data: { ...common, mode: "upgrade", buyer_membership: m } };
    }
    if (data.mode === "create") {
      return {
        kind: "create",
        data: {
          ...common,
          mode: "create",
          existing_account: data.existing_account === true,
          activation_url: strOrNull(data.activation_url),
          activation_expires_at: strOrNull(data.activation_expires_at),
        },
      };
    }
  }
  const err = isRecord(json) && isRecord(json.error) ? json.error : null;
  const code = str(err?.code);
  const message = str(err?.message) || `Erro ${status}`;
  if (code === "already_decided") return { kind: "already_decided" };
  if (code === "ambiguous_org") return { kind: "ambiguous" };
  if (code === "token_expired") return { kind: "expired" };
  if (code === "invalid_token" || code === "feature_disabled") return { kind: "invalid" };
  return { kind: "error", message };
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 rounded-xl border border-border bg-card p-6">{children}</div>;
}

/**
 * Página do botão do e-mail. NADA acontece ao abrir: o POST só sai quando o dono
 * clica em "Confirmar…".
 *
 * Por quê: Microsoft Defender (Safe Links), Proofpoint, Mimecast e afins
 * "detonam" os links de e-mail num navegador headless COM JavaScript. Se a
 * página disparasse o POST sozinha ao montar, o scanner aprovaria o PRO sem o
 * Pix ter sido conferido — ou recusaria um pedido legítimo — sem ninguém
 * clicar. Exigir um clique num botão desta página fecha isso (scanners não saem
 * clicando em botões de formulário). Para o dono continua sendo "um clique, sem
 * login" depois de abrir o e-mail.
 */
export function EmailActionRunner({
  token,
  action,
  signupId,
  amountLabel,
  buyerName,
  buyerEmailMasked,
}: {
  token: string;
  action: Action;
  signupId: string;
  amountLabel: string;
  buyerName: string | null;
  buyerEmailMasked: string | null;
}) {
  const [view, setView] = useState<View>({ kind: "confirm" });
  // Um POST por montagem, mesmo com duplo clique.
  const fired = useRef(false);

  async function run() {
    if (fired.current) return;
    fired.current = true;
    setView({ kind: "running" });
    try {
      const res = await fetch("/api/v1/public/pro-signup/email-action", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token }),
        // Sem cookie: a credencial é o token, não uma sessão que por acaso
        // esteja aberta neste navegador.
        credentials: "omit",
        cache: "no-store",
      });
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        // Corpo não-JSON (proxy, página de erro). `toView` transforma em erro
        // com o status HTTP — tratado, não engolido.
        json = null;
      }
      setView(toView(res.status, json));
    } catch (err) {
      setView({ kind: "error", message: err instanceof Error ? err.message : "Falha de rede" });
    }
  }

  const panelLink = (
    <Button asChild variant="outline" size="sm">
      <Link href={`/admin/pro-signups/${signupId}`}>Abrir no painel</Link>
    </Button>
  );

  const summary = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/30 p-4 text-sm">
      <dt className="text-muted-foreground">Comprador</dt>
      <dd className="font-medium text-foreground">{buyerName ?? "—"}</dd>
      <dt className="text-muted-foreground">E-mail</dt>
      <dd className="font-medium text-foreground">{buyerEmailMasked ?? "—"}</dd>
      <dt className="text-muted-foreground">Valor</dt>
      <dd className="font-medium text-foreground">{amountLabel}</dd>
    </dl>
  );

  switch (view.kind) {
    case "confirm":
      return (
        <Shell>
          <h1 className="text-lg font-semibold text-foreground">
            {action === "approve" ? "Aprovar e liberar o Calc3D PRO?" : "Recusar este pedido?"}
          </h1>
          {summary}
          <p className="text-xs text-muted-foreground">
            {action === "approve"
              ? "Confira o Pix no extrato antes. Ao confirmar, o acesso é liberado na hora e você recebe um e-mail de aviso."
              : "Ao confirmar, o pedido é marcado como recusado e nenhum acesso é liberado."}
          </p>
          <Button
            className="w-full"
            size="lg"
            variant={action === "approve" ? "primary" : "destructive"}
            onClick={() => void run()}
          >
            {action === "approve" ? "Confirmar aprovação" : "Confirmar recusa"}
          </Button>
          {panelLink}
        </Shell>
      );

    case "running":
      return (
        <Shell>
          <h1 className="text-lg font-semibold text-foreground">
            {action === "approve" ? "Liberando o Calc3D PRO…" : "Recusando o pedido…"}
          </h1>
          {summary}
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <CircleNotch className="h-4 w-4 animate-spin" aria-hidden />
            Aguarde, não feche esta página.
          </div>
        </Shell>
      );

    case "upgrade": {
      const appUrl = `${window.location.origin}/app/dashboard`;
      const warning = buyerMembershipWarning(view.data.buyer_membership);
      return (
        <Shell>
          <h1 className="text-lg font-semibold text-foreground">
            PRO liberado para {view.data.organization_name}
            {view.data.plan_expires_at ? ` até ${fmtDate(view.data.plan_expires_at)}` : " (sem vencimento)"}
          </h1>
          <p className="text-sm text-muted-foreground">
            A organização já existia — nenhum tenant novo foi criado. O comprador entra com a senha
            que já usa.
          </p>
          {warning ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              {warning}
            </p>
          ) : null}
          {!view.data.email_dispatched ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              O e-mail de confirmação ao comprador não saiu. Avise pelo WhatsApp — o acesso JÁ está
              liberado.
            </p>
          ) : null}
          <ManualActions
            linkLabel="Link do sistema"
            link={appUrl}
            whatsappUrl={buildWhatsappUrl(
              view.data.buyer_phone,
              buildUpgradeMessage(view.data.buyer_name, appUrl),
            )}
          />
          {panelLink}
        </Shell>
      );
    }

    case "create": {
      const appUrl = `${window.location.origin}/app/dashboard`;
      const activationUrl = view.data.existing_account ? null : view.data.activation_url;
      return (
        <Shell>
          <h1 className="text-lg font-semibold text-foreground">
            PRO liberado — organização {view.data.organization_name} criada
          </h1>
          {view.data.plan_expires_at ? (
            <p className="text-sm text-muted-foreground">
              Válido até {fmtDate(view.data.plan_expires_at)}.
            </p>
          ) : null}
          {!view.data.email_dispatched ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              O e-mail ao comprador não saiu. Avise pelo WhatsApp.
            </p>
          ) : null}
          {activationUrl ? (
            <>
              <p className="text-sm text-muted-foreground">
                O comprador cria a senha pelo link de ativação abaixo (uso único).
              </p>
              <ManualActions
                linkLabel="Link de ativação"
                link={activationUrl}
                whatsappUrl={buildWhatsappUrl(
                  view.data.buyer_phone,
                  buildActivationMessage({
                    buyerName: view.data.buyer_name,
                    activationUrl,
                    expiresAt: view.data.activation_expires_at
                      ? new Date(view.data.activation_expires_at)
                      : null,
                  }),
                )}
              />
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Conta existente: o cliente entra com a senha atual. Se não lembrar, ele usa
                “Esqueci minha senha”, que manda o link para o e-mail dele.
              </p>
              <ManualActions
                linkLabel="Link do sistema"
                link={appUrl}
                whatsappUrl={buildWhatsappUrl(
                  view.data.buyer_phone,
                  buildUpgradeMessage(view.data.buyer_name, appUrl),
                )}
              />
            </>
          )}
          {panelLink}
        </Shell>
      );
    }

    case "rejected":
      return (
        <Shell>
          <h1 className="text-lg font-semibold text-foreground">Pedido recusado</h1>
          <p className="text-sm text-muted-foreground">
            O pedido de {view.buyerName || "comprador"} foi marcado como recusado. Nenhum acesso foi
            liberado.
          </p>
          {panelLink}
        </Shell>
      );

    case "already_decided":
      return (
        <Shell>
          <h1 className="text-lg font-semibold text-foreground">Este pedido já foi decidido</h1>
          <p className="text-sm text-muted-foreground">
            Ele foi aprovado ou recusado antes — pelo painel ou por outro clique. Nada mudou agora.
          </p>
          {panelLink}
        </Shell>
      );

    case "ambiguous":
      return (
        <Shell>
          <h1 className="text-lg font-semibold text-foreground">Escolha a organização no painel</h1>
          <p className="text-sm text-muted-foreground">
            Este e-mail tem mais de uma organização — escolha no painel qual recebe o PRO. Nada foi
            liberado ainda.
          </p>
          {panelLink}
        </Shell>
      );

    case "expired":
      return (
        <Shell>
          <h1 className="text-lg font-semibold text-foreground">Link expirado</h1>
          <p className="text-sm text-muted-foreground">
            Os botões do e-mail valem 48 horas. Decida o pedido pelo painel.
          </p>
          {panelLink}
        </Shell>
      );

    case "invalid":
      return (
        <Shell>
          <h1 className="text-lg font-semibold text-foreground">Link inválido</h1>
          <p className="text-sm text-muted-foreground">Decida o pedido pelo painel.</p>
          {panelLink}
        </Shell>
      );

    case "error":
      return (
        <Shell>
          <h1 className="text-lg font-semibold text-foreground">Não consegui concluir</h1>
          <p className="text-sm text-muted-foreground">{view.message}</p>
          <p className="text-xs text-muted-foreground">
            Se o pedido continuar pendente, decida pelo painel.
          </p>
          {panelLink}
        </Shell>
      );
  }
}
