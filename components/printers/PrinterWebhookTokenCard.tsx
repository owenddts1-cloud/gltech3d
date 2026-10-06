"use client";
/**
 * PrinterWebhookTokenCard — per-org token for the printer telemetry webhook.
 *
 * Replaces the global PRINTER_WEBHOOK_SECRET (one secret for every tenant):
 * each org issues its own `dsk_...` API token with the single scope
 * `printer:webhook`. The webhook derives the org FROM THE TOKEN, so the token
 * can only ever write to the org that issued it.
 *
 * Admin-only (API tokens are admin-only server side). The plaintext comes back
 * once from POST /api/v1/settings/api-tokens and is shown once here.
 */
import { useMemo, useState } from "react";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermission } from "@/hooks/auth/AuthProvider";
import {
  useApiTokens,
  useCreateApiToken,
  useRevokeApiToken,
  type CreatedApiToken,
} from "@/hooks/team/useApiTokens";

/** Must match PRINTER_WEBHOOK_SCOPE in lib/auth/api-token.ts. */
const PRINTER_SCOPE = "printer:webhook";
const TOKEN_NAME = "Webhook impressoras";
const WEBHOOK_PATH = "/api/v1/webhooks/printers";

function sampleCurl(origin: string, token: string): string {
  return [
    `curl -X POST "${origin}${WEBHOOK_PATH}" \\`,
    `  -H "Authorization: Bearer ${token}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"printer_id":"ender3","filename":"peca.gcode","weight_grams":42,"print_time_seconds":5400}'`,
  ].join("\n");
}

function formatDate(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copiado.`);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          toast.error(
            err instanceof Error
              ? `Não foi possível copiar: ${err.message}`
              : "Não foi possível copiar — selecione e copie manualmente.",
          );
        }
      }}
    >
      {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
      Copiar {label.toLowerCase()}
    </Button>
  );
}

function PrinterWebhookTokenCardInner() {
  const { data, isLoading, isError } = useApiTokens();
  const create = useCreateApiToken();
  const revoke = useRevokeApiToken();
  const [created, setCreated] = useState<CreatedApiToken | null>(null);

  const printerTokens = useMemo(
    () => (data?.data ?? []).filter((t) => t.scopes.includes(PRINTER_SCOPE)),
    [data],
  );
  const activeCount = printerTokens.filter((t) => !t.revoked_at).length;

  // Errors are surfaced by the hooks' own `onError` (showApiError toast).
  const onGenerate = () => {
    create.mutate(
      { name: TOKEN_NAME, scopes: [PRINTER_SCOPE] },
      { onSuccess: (res) => setCreated(res.data) },
    );
  };

  const onRevoke = (id: string) => {
    revoke.mutate(id, {
      onSuccess: () =>
        toast.success("Token revogado. Impressoras que usavam ele param de registrar."),
    });
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Token do webhook
          </CardTitle>
          <CardDescription>
            Use no OctoPrint/Klipper para registrar impressões concluídas. O token só grava
            nesta organização e só serve para este webhook.
          </CardDescription>
        </div>
        <Button size="sm" onClick={onGenerate} disabled={create.isPending}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {create.isPending ? "Gerando…" : "Gerar token"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando tokens…</p>
        ) : isError ? (
          <p className="text-sm text-destructive">
            Não foi possível carregar os tokens. Recarregue a página.
          </p>
        ) : printerTokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum token gerado. Sem token, a impressora não consegue registrar trabalhos.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {printerTokens.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <code className="text-xs">{t.prefix}_…</code>
                    {t.revoked_at ? (
                      <Badge variant="destructive">Revogado</Badge>
                    ) : (
                      <Badge variant="secondary">Ativo</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Criado em {formatDate(t.created_at)} · último uso {formatDate(t.last_used_at)}
                  </p>
                </div>
                {!t.revoked_at ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    onClick={() => onRevoke(t.id)}
                  >
                    Revogar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {activeCount > 1 ? (
          <p className="text-xs text-muted-foreground">
            Há {activeCount} tokens ativos. Revogue os que não estão mais em uso.
          </p>
        ) : null}
      </CardContent>

      <Dialog open={!!created} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Token gerado</DialogTitle>
            <DialogDescription>
              Copie agora — por segurança ele não será mostrado de novo. Se perder, revogue e gere
              outro.
            </DialogDescription>
          </DialogHeader>
          {created ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <code className="block break-all rounded-md border bg-muted p-3 text-sm">
                  {created.plaintext}
                </code>
                <CopyButton value={created.plaintext} label="Token" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Exemplo de chamada</p>
                <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs leading-relaxed">
                  {sampleCurl(origin, created.plaintext)}
                </pre>
                <CopyButton value={sampleCurl(origin, created.plaintext)} label="Comando" />
                <p className="text-xs text-muted-foreground">
                  O token vai sempre no cabeçalho (<code>Authorization: Bearer</code> ou{" "}
                  <code>X-Webhook-Secret</code>), nunca na URL. Não é preciso informar{" "}
                  <code>orgId</code>: a organização vem do token.
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Já copiei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Renders nothing for non-admins (token endpoints are admin-only). */
export function PrinterWebhookTokenCard() {
  const canManage = usePermission("settings.write");
  if (!canManage) return null;
  return <PrinterWebhookTokenCardInner />;
}
