"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReasonDialog } from "@/components/admin/subscribers/ReasonDialog";
import {
  PlanStatusBadge,
  REQUEST_STATUS_LABEL,
  formatDateTime,
  formatDay,
  planExpiryText,
} from "@/components/admin/subscribers/plan-display";
import {
  useSubscriber,
  useUpdateSubscriberMemberRole,
  useUpdateSubscriberPlan,
  type PlanMutation,
  type SubscriberDetail,
  type SubscriberMember,
} from "@/hooks/useSubscribers";
import { ApiError } from "@/lib/api/types";
import type { Role } from "@/lib/auth/types";
import type { PlanTier } from "@/lib/plan/types";
import { formatBRL } from "@/lib/pricing/pro-plans";

const TIER_OPTIONS: ReadonlyArray<{ value: PlanTier; label: string }> = [
  { value: "pro", label: "Calc3D PRO" },
  { value: "enterprise", label: "Enterprise" },
  { value: "standard", label: "Gratuito (standard)" },
];

const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Gerente" },
  { value: "agent", label: "Atendente" },
  { value: "viewer", label: "Leitura" },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label]),
);

const ACTION_LABEL: Record<string, string> = {
  "tenant.plan_changed": "Plano alterado",
  "tenant.plan_extended": "Plano estendido",
  "tenant.plan_revoked": "Plano removido",
  "member.role_changed_by_platform_admin": "Papel alterado pela plataforma",
  "member.role_changed": "Papel alterado",
  "pro_signup.approved": "Pedido PRO aprovado",
  "pro_signup.rejected": "Pedido PRO recusado",
  "pro_signup.requested": "Pedido PRO enviado",
  "signup.trial_started": "Trial iniciado",
};

/** Turns `YYYY-MM-DD` from the date input into end-of-day in São Paulo (UTC-3, no DST). */
function endOfDaySaoPaulo(date: string): string {
  return new Date(`${date}T23:59:59-03:00`).toISOString();
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : "Falha inesperada.";
}

/** `Omit` that keeps the union apart (plain `Omit` on a union keeps only common keys). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

interface PendingPlan {
  mutation: DistributiveOmit<PlanMutation, "reason">;
  title: string;
  description: string;
  destructive?: boolean;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan card
// ---------------------------------------------------------------------------

function PlanCard({ detail }: { detail: SubscriberDetail }) {
  const { organization: org, state } = detail;
  const update = useUpdateSubscriberPlan(org.id);

  const currentTier: PlanTier =
    org.plan === "pro" || org.plan === "enterprise" ? org.plan : "standard";
  const [tier, setTier] = useState<PlanTier>(currentTier === "standard" ? "pro" : currentTier);
  const [noExpiry, setNoExpiry] = useState(false);
  const [date, setDate] = useState("");
  const [pending, setPending] = useState<PendingPlan | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Pre-fill the form with what is saved, once per load of the org.
  useEffect(() => {
    setNoExpiry(currentTier !== "standard" && org.plan_expires_at === null);
    setDate(toDateInput(org.plan_expires_at));
  }, [org.id, org.plan_expires_at, currentTier]);

  const paidWithoutExpiry = currentTier !== "standard" && org.plan_expires_at === null;

  function ask(p: PendingPlan) {
    setDialogError(null);
    setPending(p);
  }

  function askSet() {
    if (tier === "standard") {
      ask({
        mutation: { action: "set", plan: "standard", expires_at: null },
        title: "Mudar para o plano gratuito",
        description:
          "O cliente perde os módulos PRO. Um trial em andamento continua valendo — para cortar tudo, use “Remover plano”.",
        destructive: true,
      });
      return;
    }
    if (!noExpiry && !date) {
      toast.error("Escolha a data de vencimento ou marque “Sem vencimento”.");
      return;
    }
    const expiresAt = noExpiry ? null : endOfDaySaoPaulo(date);
    const label = TIER_OPTIONS.find((t) => t.value === tier)?.label ?? tier;
    ask({
      mutation: { action: "set", plan: tier, expires_at: expiresAt },
      title: `Definir ${label}`,
      description: noExpiry
        ? `${org.display_name} passa a ter ${label} sem data de vencimento.`
        : `${org.display_name} passa a ter ${label} até ${formatDay(expiresAt)} (fim do dia, horário de Brasília).`,
    });
  }

  function askExtend(days: number) {
    ask({
      mutation: { action: "extend", days },
      title: `Estender ${days} dias`,
      description:
        currentTier === "standard"
          ? `${org.display_name} vira PRO por ${days} dias a partir de agora.`
          : `Soma ${days} dias ao que ainda resta do plano (renovação não perde dias).`,
    });
  }

  function askRevoke() {
    ask({
      mutation: { action: "revoke" },
      title: "Remover plano",
      description:
        "Volta para o plano gratuito e encerra um trial em andamento. O acesso aos módulos PRO é cortado na próxima navegação do cliente. Os dados não são apagados.",
      destructive: true,
    });
  }

  async function confirm(reason: string) {
    if (!pending) return;
    try {
      await update.mutateAsync({ ...pending.mutation, reason });
      toast.success("Plano atualizado. O cliente será avisado por e-mail.");
      setPending(null);
    } catch (err) {
      setDialogError(errorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plano</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Row label="Situação" value={<PlanStatusBadge state={state} />} />
          <Row label="Vencimento" value={planExpiryText(state)} />
          <Row label="Plano gravado" value={<code className="text-xs">{org.plan ?? "—"}</code>} />
          <Row label="Fim do trial" value={formatDateTime(org.trial_ends_at)} />
          <Row label="Vence em" value={org.plan_expires_at ? formatDateTime(org.plan_expires_at) : "—"} />
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">Definir plano</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tier">Tipo</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as PlanTier)}>
                <SelectTrigger id="tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expires">Vence em</Label>
              <Input
                id="expires"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={noExpiry || tier === "standard"}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="no-expiry"
              checked={noExpiry}
              onCheckedChange={setNoExpiry}
              disabled={tier === "standard"}
            />
            <Label htmlFor="no-expiry" className="text-sm font-normal">
              Sem vencimento
            </Label>
          </div>
          <Button size="sm" onClick={askSet}>
            Aplicar plano
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => askExtend(30)}
            disabled={paidWithoutExpiry}
            title={paidWithoutExpiry ? "Plano sem vencimento — não há o que estender" : undefined}
          >
            +30 dias
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => askExtend(365)}
            disabled={paidWithoutExpiry}
            title={paidWithoutExpiry ? "Plano sem vencimento — não há o que estender" : undefined}
          >
            +365 dias
          </Button>
          <Button size="sm" variant="destructive" className="ml-auto" onClick={askRevoke}>
            Remover plano
          </Button>
        </div>
      </CardContent>

      <ReasonDialog
        open={pending !== null}
        onOpenChange={(o) => (!o ? setPending(null) : undefined)}
        title={pending?.title ?? ""}
        description={pending?.description ?? ""}
        confirmLabel={pending?.destructive ? "Confirmar remoção" : "Confirmar"}
        destructive={pending?.destructive}
        pending={update.isPending}
        error={dialogError}
        onConfirm={(reason) => void confirm(reason)}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Members card
// ---------------------------------------------------------------------------

function MembersCard({ detail }: { detail: SubscriberDetail }) {
  const update = useUpdateSubscriberMemberRole(detail.organization.id);
  const [pending, setPending] = useState<{ member: SubscriberMember; role: Role } | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  async function confirm(reason: string) {
    if (!pending) return;
    try {
      await update.mutateAsync({ userId: pending.member.user_id, role: pending.role, reason });
      toast.success("Papel alterado.");
      setPending(null);
    } catch (err) {
      setDialogError(
        err instanceof ApiError && err.code === "last_admin"
          ? "Não dá para rebaixar: esta pessoa é o último admin ativo da organização. Promova outro membro a admin primeiro."
          : errorMessage(err),
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Membros</CardTitle>
      </CardHeader>
      <CardContent>
        {detail.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum membro.</p>
        ) : (
          <ul className="divide-y divide-border">
            {detail.members.map((m) => {
              const revoked = !!m.revoked_at;
              return (
                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.email ?? m.user_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {revoked
                        ? `Revogado em ${formatDay(m.revoked_at)}`
                        : m.accepted_at
                          ? `Desde ${formatDay(m.accepted_at)}`
                          : "Convite não aceito"}
                    </p>
                  </div>
                  {revoked ? (
                    <Badge variant="neutral">{ROLE_LABEL[m.role] ?? m.role} (revogado)</Badge>
                  ) : (
                    <Select
                      value={m.role}
                      onValueChange={(v) => {
                        if (v === m.role) return;
                        setDialogError(null);
                        setPending({ member: m, role: v as Role });
                      }}
                    >
                      <SelectTrigger className="h-8 w-36" aria-label={`Papel de ${m.email ?? m.user_id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <ReasonDialog
        open={pending !== null}
        onOpenChange={(o) => (!o ? setPending(null) : undefined)}
        title="Alterar papel"
        description={
          pending
            ? `${pending.member.email ?? pending.member.user_id}: ${ROLE_LABEL[pending.member.role] ?? pending.member.role} → ${ROLE_LABEL[pending.role]}`
            : ""
        }
        confirmLabel="Alterar papel"
        pending={update.isPending}
        error={dialogError}
        onConfirm={(reason) => void confirm(reason)}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// History card
// ---------------------------------------------------------------------------

function auditReason(metadata: Record<string, unknown> | null): string | null {
  const r = metadata?.reason;
  return typeof r === "string" ? r : null;
}

function auditVia(metadata: Record<string, unknown> | null): string | null {
  return metadata?.via === "email_link" ? "pelo link do e-mail" : null;
}

function HistoryCard({ detail }: { detail: SubscriberDetail }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Histórico</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">Pedidos do Calc3D PRO</p>
          {detail.requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido vinculado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {detail.requests.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <Link href={`/admin/pro-signups/${r.id}`} className="font-medium underline">
                        {r.buyer_name}
                      </Link>{" "}
                      <span className="text-muted-foreground">· {formatBRL(r.amount_cents)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(r.created_at)}
                      {r.review_note ? ` · ${r.review_note}` : ""}
                    </p>
                  </div>
                  <Badge variant={r.status === "pending" ? "default" : r.status === "rejected" ? "error" : "neutral"}>
                    {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Auditoria (últimos 20)</p>
          {detail.audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos.</p>
          ) : (
            <ul className="divide-y divide-border">
              {detail.audit.map((a) => {
                const reason = auditReason(a.metadata);
                const via = auditVia(a.metadata);
                return (
                  <li key={a.id} className="py-2.5">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>
                      {a.acting_as_platform_admin ? <Badge variant="info">plataforma</Badge> : null}
                      {via ? <Badge variant="warning">{via}</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(a.created_at)}
                      {reason ? ` · “${reason}”` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function SubscriberDetailClient({ orgId }: { orgId: string }) {
  const { data, isLoading, isError, error } = useSubscriber(orgId);
  const detail = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Falha ao carregar o assinante: {error instanceof Error ? error.message : "não encontrado"}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/assinantes" className="text-xs text-muted-foreground underline">
            ← Assinantes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{detail.organization.display_name}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{detail.organization.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <PlanStatusBadge state={detail.state} />
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/tenants/${detail.organization.id}`}>Abrir tenant</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PlanCard detail={detail} />
        <MembersCard detail={detail} />
        <HistoryCard detail={detail} />
      </div>
    </div>
  );
}
