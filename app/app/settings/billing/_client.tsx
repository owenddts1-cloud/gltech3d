"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Lock, Copy, CheckCircle } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { formatBRL, monthlyEquivalentCents, proPlanWith } from "@/lib/pricing/pro-plans";
import type { PublicProPricing } from "@/lib/pricing/settings-schema";
import type { ProPixCheckout } from "@/lib/pix/qr";
import { storeWhatsappUrl } from "@/lib/landing/whatsapp-number";
import type { PlanState } from "@/lib/plan/types";
import type { ProModule } from "@/lib/plan/modules";
import { PRO_REQUEST_FORBIDDEN_MESSAGE } from "@/lib/pro-signup/request-permission";


function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function statusLine(plan: PlanState | null): { title: string; detail: string; tone: string } {
  if (!plan) {
    return {
      title: "Plano não identificado",
      detail: "Não consegui ler o plano desta organização. Fale no WhatsApp.",
      tone: "text-muted-foreground",
    };
  }
  switch (plan.status) {
    case "active":
      return {
        title: "Calc3D PRO ativo",
        detail: plan.planExpiresAt
          ? `Válido até ${formatDate(plan.planExpiresAt)}.`
          : "Sem data de expiração.",
        tone: "text-green-600",
      };
    case "trialing":
      return {
        title: `Trial: ${plan.trialDaysLeft} ${plan.trialDaysLeft === 1 ? "dia restante" : "dias restantes"}`,
        detail: `Acaba em ${formatDate(plan.trialEndsAt)}. Nada é cobrado automaticamente.`,
        tone: "text-amber-600",
      };
    case "trial_expired":
      return {
        title: "Trial encerrado",
        detail: `Terminou em ${formatDate(plan.trialEndsAt)}. Seus dados continuam guardados.`,
        tone: "text-destructive",
      };
    case "expired":
      return {
        title: "Assinatura vencida",
        detail: `Venceu em ${formatDate(plan.planExpiresAt)}. Renove para destravar.`,
        tone: "text-destructive",
      };
    case "none":
      return {
        title: "Plano gratuito",
        detail: "Calculadora e Dashboard liberados. Os demais módulos são do PRO.",
        tone: "text-muted-foreground",
      };
  }
}

export function BillingClient({
  plan,
  orgName,
  lockedLabel,
  modules,
  buyerName,
  buyerEmail,
  canRequest,
  pricing,
  pix,
  storeWhatsapp,
}: {
  plan: PlanState | null;
  orgName: string | null;
  lockedLabel: string | null;
  modules: ProModule[];
  buyerName: string;
  buyerEmail: string;
  /** Só o admin da org (ou platform admin) pede o PRO — mesma regra da rota. */
  canRequest: boolean;
  /** Live price/period/trial (platform_settings), from the server page. */
  pricing: PublicProPricing;
  /** Pix code + QR generated on the server with the live price (lib/pix/qr.ts). */
  pix: ProPixCheckout;
  /** Store WhatsApp digits (lib/landing/whatsapp.ts). */
  storeWhatsapp: string;
}) {
  const PIX_KEY = pix.key ?? "";
  const PIX_RECEIVER = pix.receiverName;
  const qrImage = pix.qrDataUrl ?? pix.qrSrc;
  const WHATSAPP_URL = storeWhatsappUrl(storeWhatsapp);
  const [copied, setCopied] = useState<"key" | "code" | null>(null);
  const [qrAvailable, setQrAvailable] = useState(true);
  const copiaECola = pix.copiaECola;
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const planInfo = proPlanWith(pricing);
  const status = statusLine(plan);
  const isPaid = plan?.status === "active";

  async function copy(text: string, which: "key" | "code") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      // Clipboard bloqueado (contexto inseguro). O texto continua visível para
      // seleção manual — nada a fazer.
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/v1/pro-signup/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_name: String(form.get("buyer_name") ?? ""),
          buyer_phone: String(form.get("buyer_phone") ?? ""),
          pix_txid: String(form.get("pix_txid") ?? "") || undefined,
        }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          // Another pending request holds this e-mail: the route explains it in pt-BR.
          const body: unknown = await res.json().catch(() => null);
          const message =
            typeof body === "object" && body !== null && "error" in body
              ? (body as { error?: { message?: unknown } }).error?.message
              : undefined;
          toast.error(typeof message === "string" ? message : "Já existe um pedido pendente com este e-mail.");
          return;
        }
        toast.error(
          res.status === 403
            ? PRO_REQUEST_FORBIDDEN_MESSAGE
            : "Não consegui registrar o pedido. Tente de novo ou fale no WhatsApp.",
        );
        return;
      }
      setSent(true);
      toast.success("Pedido registrado. Vou conferir o Pix e liberar.");
    } catch {
      toast.error("Falha de rede. Tente de novo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Plano e cobrança</h1>
        <p className="text-sm text-muted-foreground">
          {orgName ? `Organização: ${orgName}` : "Estado da sua assinatura."}
        </p>
      </header>

      {lockedLabel ? (
        <Card className="flex items-start gap-3 border-amber-500/40 bg-amber-500/10 p-4">
          <Lock size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-sm">
            Você tentou abrir <strong>{lockedLabel}</strong>. Faz parte do Calc3D PRO.
          </p>
        </Card>
      ) : null}

      <Card className="space-y-1 p-6">
        <h2 className={cn("text-sm font-semibold", status.tone)}>{status.title}</h2>
        <p className="text-sm text-muted-foreground">{status.detail}</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">{planInfo.label}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{planInfo.tagline}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums">{formatBRL(planInfo.amountCents)}</p>
              <p className="text-xs text-muted-foreground">
                ~{formatBRL(monthlyEquivalentCents(planInfo))}/mês
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isPaid ? "Incluído no seu plano" : "O que destrava"}
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {modules.map((m) => (
                <li key={m.routePrefix} className="flex items-start gap-2 text-sm">
                  {isPaid ? (
                    <Check size={14} aria-hidden className="mt-1 shrink-0 text-green-600" />
                  ) : (
                    <Lock size={12} weight="fill" aria-hidden className="mt-1 shrink-0 opacity-50" />
                  )}
                  <span className={isPaid ? "" : "text-muted-foreground"}>{m.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {!isPaid && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Calculadora, Dashboard e Configurações continuam livres — mesmo depois dos{" "}
              {pricing.trialDays} dias. Nada é apagado.
            </p>
          )}
        </Card>

        {!isPaid && (
          <Card className="space-y-4 p-6">
            <h2 className="text-sm font-semibold">Pagar por Pix</h2>

            {PIX_KEY ? (
              <div className="space-y-4">
                {qrImage && qrAvailable ? (
                  <div className="flex flex-col items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- QR pequeno e estático; next/image roda com unoptimized neste projeto */}
                    <img
                      src={qrImage}
                      alt="QR Code do Pix"
                      width={180}
                      height={180}
                      onError={() => setQrAvailable(false)}
                      className="rounded-lg border border-border"
                    />
                    <span className="text-xs text-muted-foreground">Escaneie no app do seu banco</span>
                  </div>
                ) : null}

                {copiaECola ? (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pix copia e cola · {formatBRL(planInfo.amountCents)}
                    </p>
                    <p className="mt-1 max-h-20 overflow-y-auto break-all font-mono text-[11px]">
                      {copiaECola}
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 gap-2"
                      onClick={() => void copy(copiaECola, "code")}
                    >
                      {copied === "code" ? <CheckCircle size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                      {copied === "code" ? "Código copiado" : "Copiar código Pix"}
                    </Button>
                  </div>
                ) : null}

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ou pela chave Pix
                  </p>
                  <p className="mt-1 break-all font-mono text-sm font-medium">{PIX_KEY}</p>
                  {PIX_RECEIVER ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Recebedor: <strong className="text-foreground">{PIX_RECEIVER}</strong> — confira
                      antes de concluir.
                    </p>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-2"
                    onClick={() => void copy(PIX_KEY, "key")}
                  >
                    {copied === "key" ? <CheckCircle size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                    {copied === "key" ? "Chave copiada" : "Copiar chave"}
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Pela chave, digite {formatBRL(planInfo.amountCents)} à mão.
                  </p>
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                A chave Pix ainda não foi configurada neste ambiente.{" "}
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="underline">
                  Fale no WhatsApp
                </a>
                .
              </p>
            )}

            {!canRequest ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
                {PRO_REQUEST_FORBIDDEN_MESSAGE} Peça a ele para registrar o pagamento por esta tela.
              </p>
            ) : sent ? (
              <p className="rounded-md border border-green-600/40 bg-green-600/10 px-3 py-3 text-sm">
                Pedido registrado. Vou conferir o pagamento e destravar seu acesso — normalmente no
                mesmo dia útil. O aviso chega em <strong>{buyerEmail}</strong>.
              </p>
            ) : (
              <form onSubmit={onSubmit} className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Preencha depois de pagar. A liberação é manual: eu confiro o Pix e destravo.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="buyer_name">Seu nome</Label>
                  <Input id="buyer_name" name="buyer_name" required defaultValue={buyerName} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="buyer_phone">WhatsApp</Label>
                  <Input id="buyer_phone" name="buyer_phone" required placeholder="(31) 99999-9999" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pix_txid">Código da transação (opcional)</Label>
                  <Input id="pix_txid" name="pix_txid" />
                </div>
                <Button type="submit" className="w-full" disabled={sending}>
                  {sending ? "Registrando…" : "Já paguei — liberar meu acesso"}
                </Button>
              </form>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
