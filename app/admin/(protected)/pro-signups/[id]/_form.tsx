"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ManualActions } from "@/components/pro-signup/ManualActions";
import { buyerMembershipWarning } from "@/lib/pro-signup/buyer-membership";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useProSignup,
  useApproveProSignup,
  useRejectProSignup,
  type ApproveProSignupResponse,
} from "@/hooks/useProSignups";
import { formatBRL } from "@/lib/pricing/pro-plans";
import { slugify } from "@/lib/text/slugify";
import { ApiError } from "@/lib/api/types";
import {
  buildWhatsappUrl,
  buildActivationMessage,
  buildUpgradeMessage,
} from "@/lib/pro-signup/whatsapp-message";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function ProSignupDetailClient({ id }: { id: string }) {
  const { data, isLoading, isError, error } = useProSignup(id);
  const approve = useApproveProSignup(id);
  const reject = useRejectProSignup(id);

  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [approved, setApproved] = useState<ApproveProSignupResponse["data"] | null>(null);

  const row = data?.data;

  // Pré-preenche a partir do pedido assim que ele chega. O nome da operação que o
  // comprador digitou é o melhor palpite; o admin ainda pode corrigir.
  useEffect(() => {
    if (!row) return;
    const suggested = row.company_name?.trim() || row.buyer_name;
    setDisplayName((prev) => prev || suggested);
    setSlug((prev) => prev || slugify(suggested));
  }, [row]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (isError || !row) {
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Falha ao carregar o pedido: {error instanceof Error ? error.message : "não encontrado"}
      </p>
    );
  }

  const isPending = row.status === "pending";

  async function onApprove() {
    try {
      const res = await approve.mutateAsync({ display_name: displayName, slug });
      setApproved(res.data);
      toast.success(
        res.data.email_dispatched
          ? "Liberado. O e-mail de ativação saiu."
          : "Liberado, mas o e-mail NÃO saiu. Envie o link manualmente.",
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.code === "conflict"
          ? err.message
          : "Falha ao aprovar o pedido.",
      );
    }
  }

  async function onReject() {
    try {
      await reject.mutateAsync(rejectNote || undefined);
      toast.success("Pedido rejeitado.");
    } catch {
      toast.error("Falha ao rejeitar o pedido.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{row.buyer_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{row.buyer_email}</p>
        </div>
        <Badge variant={isPending ? "default" : "secondary"}>{row.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagamento declarado</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Plano" value={row.plan} />
            <Row label="Valor" value={formatBRL(row.amount_cents)} />
            <Row
              label="Declarado em"
              value={new Date(row.declared_paid_at).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            />
            <Row label="Código do Pix" value={row.pix_txid ?? "—"} />
            <Row label="WhatsApp" value={row.buyer_phone ?? "—"} />
            <Row label="Empresa" value={row.company_name ?? "—"} />
            <Row label="IP de origem" value={row.request_ip ?? "—"} />
            <Row
              label="Comprovante"
              value={
                row.receipt_url ? (
                  <a
                    href={row.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Abrir comprovante
                  </a>
                ) : row.receipt_storage_path ? (
                  "Anexado (link indisponível)"
                ) : (
                  "Não enviado"
                )
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isPending ? "Liberar acesso" : "Resultado"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {approved ? (
              <div className="space-y-3">
                {approved.mode === "upgrade" ? (
                  <>
                    <p className="text-sm text-foreground">
                      Organização <strong>já existente</strong> liberada — nenhum tenant novo foi
                      criado. O comprador entra com a senha que já usa.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {approved.plan_expires_at
                        ? `Acesso válido até ${new Date(approved.plan_expires_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`
                        : "A organização já tinha plano sem vencimento — mantido."}
                    </p>
                    {buyerMembershipWarning(approved.buyer_membership) ? (
                      <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                        {buyerMembershipWarning(approved.buyer_membership)}
                      </p>
                    ) : null}
                    {!approved.email_dispatched ? (
                      <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        O e-mail de confirmação não saiu. Avise pelo WhatsApp — o acesso JÁ está
                        liberado.
                      </p>
                    ) : null}
                    <ManualActions
                      linkLabel="Link do sistema"
                      link={`${window.location.origin}/app/dashboard`}
                      whatsappUrl={buildWhatsappUrl(
                        row.buyer_phone,
                        buildUpgradeMessage(
                          row.buyer_name,
                          `${window.location.origin}/app/dashboard`,
                        ),
                      )}
                    />
                  </>
                ) : (
                  <>
                    <p className="text-sm text-foreground">
                      Tenant <strong>{approved.organization.display_name}</strong> criado (
                      <code className="text-xs">{approved.organization.slug}</code>).
                    </p>
                    {!approved.email_dispatched ? (
                      <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        O e-mail ao comprador não foi enviado (transporte não configurado ou
                        domínio não verificado). Avise pelo WhatsApp.
                      </p>
                    ) : null}
                    {approved.existing_account || !approved.activation_url ? (
                      <>
                        <p className="text-sm text-foreground">
                          Conta existente: o cliente entra com a senha atual. Não há link de
                          ativação — se ele não lembrar a senha, use “Esqueci minha senha”, que
                          manda o link para o e-mail dele.
                        </p>
                        <ManualActions
                          linkLabel="Link do sistema"
                          link={`${window.location.origin}/app/dashboard`}
                          whatsappUrl={buildWhatsappUrl(
                            row.buyer_phone,
                            buildUpgradeMessage(
                              row.buyer_name,
                              `${window.location.origin}/app/dashboard`,
                            ),
                          )}
                        />
                      </>
                    ) : (
                      <>
                        <ManualActions
                          linkLabel="Link de ativação"
                          link={approved.activation_url}
                          whatsappUrl={buildWhatsappUrl(
                            row.buyer_phone,
                            buildActivationMessage({
                              buyerName: row.buyer_name,
                              activationUrl: approved.activation_url,
                              expiresAt: approved.activation_expires_at
                                ? new Date(approved.activation_expires_at)
                                : null,
                            }),
                          )}
                        />
                        <p className="text-xs text-muted-foreground">
                          Link de uso único (cria a conta e a senha).
                          {approved.activation_expires_at
                            ? ` Expira em ${new Date(approved.activation_expires_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`
                            : ""}
                        </p>
                      </>
                    )}
                  </>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/pro-signups">Voltar para a fila</Link>
                </Button>
              </div>
            ) : isPending ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="display_name">Nome do tenant</Label>
                  <Input
                    id="display_name"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (!slugTouched) setSlug(slugify(e.target.value));
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugify(e.target.value));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Precisa ser único na plataforma. Se já existir, a aprovação devolve conflito.
                  </p>
                </div>

                <Button
                  className="w-full"
                  disabled={approve.isPending || displayName.length < 2 || slug.length < 2}
                  onClick={() => void onApprove()}
                >
                  {approve.isPending ? "Liberando…" : "Aprovar e criar o tenant"}
                </Button>

                <div className="space-y-1.5 border-t border-border pt-4">
                  <Label htmlFor="reject_note">Motivo da recusa (opcional)</Label>
                  <Input
                    id="reject_note"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Pix não localizado"
                  />
                  <Button
                    variant="outline"
                    className="mt-2 w-full"
                    disabled={reject.isPending}
                    onClick={() => void onReject()}
                  >
                    {reject.isPending ? "Rejeitando…" : "Rejeitar pedido"}
                  </Button>
                </div>
              </>
            ) : (
              <div>
                <Row label="Status" value={row.status} />
                <Row
                  label="Revisado em"
                  value={
                    row.reviewed_at
                      ? new Date(row.reviewed_at).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })
                      : "—"
                  }
                />
                <Row label="Observação" value={row.review_note ?? "—"} />
                <Row
                  label="Tenant"
                  value={
                    row.organization_id ? (
                      <Link href={`/admin/tenants/${row.organization_id}`} className="underline">
                        Abrir tenant
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
