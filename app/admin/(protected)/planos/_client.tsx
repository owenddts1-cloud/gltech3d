"use client";

/**
 * /admin/planos — Calc3D PRO price, period, trial, benefit lines and the
 * public calculator defaults (platform_settings, migration 0087).
 * Changes apply to NEW requests only; pending Pix requests keep their amount.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CaretDown, CaretUp, Plus, Trash, Warning, Check } from "@/lib/ui/icons";
import { ApiError } from "@/lib/api/types";
import { formatBRL, periodSuffix } from "@/lib/pricing/pro-plans";
import { PRO_BENEFIT_MAX_ITEMS } from "@/lib/pricing/settings-schema";
import {
  CALCULATOR_FIELDS,
  buildPlanPatch,
  formFromSettings,
  moveItem,
  parsePriceToCents,
  type PlanFormState,
  type PlanPatch,
} from "@/lib/admin/platform-settings-form";
import { usePlatformSettings, useUpdatePlatformSettings } from "@/hooks/usePlatformSettings";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const PATCH_LABEL: Record<keyof PlanPatch, string> = {
  pro_price_cents: "preço",
  pro_period_days: "período",
  trial_days: "dias de teste",
  pro_benefits: "benefícios",
  calculator_defaults: "padrões da calculadora",
};

export function PlanosClient() {
  const { data, isLoading, isError, error } = usePlatformSettings();
  const update = useUpdatePlatformSettings();
  const settings = data?.data;
  const [form, setForm] = useState<PlanFormState | null>(null);
  const [pendingPatch, setPendingPatch] = useState<PlanPatch | null>(null);

  useEffect(() => {
    if (settings) setForm(formFromSettings(settings));
  }, [settings]);

  const preview = useMemo(() => {
    if (!form) return null;
    const cents = parsePriceToCents(form.price);
    const days = Number(form.periodDays);
    if (!Number.isFinite(cents) || !Number.isInteger(days) || days < 1) return null;
    return {
      price: formatBRL(cents),
      suffix: periodSuffix(days),
      // Same formula as monthlyEquivalentCents (lib/pricing/pro-plans.ts).
      monthly: formatBRL(Math.round(cents / (days / 30.4375))),
    };
  }, [form]);

  if (isLoading || (!form && !isError)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !settings || !form) {
    return (
      <p role="alert" className="rounded-md border border-error/40 bg-error-bg px-4 py-3 text-sm text-error-fg">
        Não consegui carregar as configurações: {error instanceof Error ? error.message : "erro desconhecido"}.
      </p>
    );
  }

  const set = <K extends keyof PlanFormState>(key: K, value: PlanFormState[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  function review() {
    if (!form || !settings) return;
    const r = buildPlanPatch(form, settings);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    if (Object.keys(r.patch).length === 0) {
      toast.info("Nada mudou.");
      return;
    }
    setPendingPatch(r.patch);
  }

  function save() {
    const patch = pendingPatch;
    setPendingPatch(null);
    if (!patch) return;
    update.mutate(patch, {
      onSuccess: () => toast.success("Configurações salvas. A página /calc3d-pro já mostra os novos valores."),
      onError: (err) =>
        toast.error(err instanceof ApiError ? `${err.message} (${err.code})` : err instanceof Error ? err.message : "Falha ao salvar."),
    });
  }

  const benefits = form.benefits;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Planos e preços</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Preço e período do Calc3D PRO, dias de teste grátis, a lista de benefícios do card de planos e os valores
            iniciais da calculadora pública. Vale para pedidos novos: quem já pediu mantém o valor do pedido.
          </p>
          {settings.updated_at ? (
            <p className="mt-1 text-xs text-text-muted">
              Última alteração: {new Date(settings.updated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
          ) : null}
        </div>
        <Button onClick={review} disabled={update.isPending}>
          <Check /> {update.isPending ? "Salvando…" : "Revisar e salvar"}
        </Button>
      </div>

      {settings.is_fallback ? (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-warning-fg">
          <Warning size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            A linha de configurações não pôde ser lida: os valores abaixo são os padrões de fábrica e é isso que o site está
            mostrando. Salvar grava estes valores no banco.
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Section title="Preço do PRO" description="Cobrado por Pix, liberação manual.">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-price" className="text-xs">Preço (R$)</Label>
                <Input id="plan-price" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} />
                <p className="text-[11px] text-text-muted">Entre R$ 1,00 e R$ 100.000,00.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-period" className="text-xs">Período (dias)</Label>
                <Input id="plan-period" inputMode="numeric" value={form.periodDays} onChange={(e) => set("periodDays", e.target.value)} />
                <p className="text-[11px] text-text-muted">365 = anual. 1 a 3650.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-trial" className="text-xs">Teste grátis (dias)</Label>
                <Input id="plan-trial" inputMode="numeric" value={form.trialDays} onChange={(e) => set("trialDays", e.target.value)} />
                <p className="text-[11px] text-text-muted">0 a 90. Vale para contas novas.</p>
              </div>
            </div>
          </Section>

          <Section
            title="Benefícios do card PRO"
            description={`Até ${PRO_BENEFIT_MAX_ITEMS} linhas. O título aparece em negrito; o detalhe, menor. Lista vazia = padrão de fábrica. Prometa só o que o produto entrega hoje.`}
          >
            <ol className="space-y-2">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 rounded-md border border-border p-2">
                  <span className="mt-2 w-5 text-center text-xs tabular-nums text-text-muted">{i + 1}</span>
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1.6fr]">
                    <Input
                      value={b.title}
                      placeholder="Título"
                      aria-label={`Título do benefício ${i + 1}`}
                      onChange={(e) => set("benefits", benefits.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    />
                    <Input
                      value={b.detail}
                      placeholder="Detalhe (opcional)"
                      aria-label={`Detalhe do benefício ${i + 1}`}
                      onChange={(e) => set("benefits", benefits.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))}
                    />
                  </div>
                  <div className="flex flex-col">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => set("benefits", moveItem(benefits, i, -1))} aria-label="Subir">
                      <CaretUp size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={i === benefits.length - 1}
                      onClick={() => set("benefits", moveItem(benefits, i, 1))}
                      aria-label="Descer"
                    >
                      <CaretDown size={14} />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:text-error"
                    onClick={() => set("benefits", benefits.filter((_, j) => j !== i))}
                    aria-label={`Remover benefício ${i + 1}`}
                  >
                    <Trash size={14} />
                  </Button>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={benefits.length >= PRO_BENEFIT_MAX_ITEMS}
                onClick={() => set("benefits", [...benefits, { title: "", detail: "" }])}
              >
                <Plus /> Adicionar benefício
              </Button>
              {settings.defaults ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => settings.defaults && set("benefits", formFromSettings(settings.defaults).benefits)}
                >
                  Restaurar lista padrão
                </Button>
              ) : null}
            </div>
          </Section>

          <Section title="Valores iniciais da calculadora" description="O que a calculadora grátis mostra para quem chega. Valores salvos no navegador do visitante continuam valendo para ele.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CALCULATOR_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`calc-${f.key}`} className="flex items-baseline justify-between text-xs">
                    {f.label}
                    <span className="text-[10px] uppercase tracking-wider text-text-muted">{f.unit}</span>
                  </Label>
                  <Input
                    id={`calc-${f.key}`}
                    inputMode="decimal"
                    value={form.calculator[f.key]}
                    onChange={(e) => set("calculator", { ...form.calculator, [f.key]: e.target.value })}
                  />
                  <p className="text-[11px] text-text-muted">
                    {String(f.min).replace(".", ",")} a {f.max.toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg bg-[#2D241E] p-5 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D9C7A8]">Prévia do card</p>
            {preview ? (
              <>
                <p className="mt-3 text-4xl font-black leading-none">{preview.price}</p>
                <p className="mt-1 text-sm text-[#D5CBBF]">/{preview.suffix} · equivale a {preview.monthly}/mês</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-[#D5CBBF]">Preço ou período inválido.</p>
            )}
            <p className="mt-3 text-xs text-[#D5CBBF]">Começar {form.trialDays || "?"} dias grátis</p>
            <ul className="mt-4 space-y-1.5 text-xs">
              {benefits
                .filter((b) => b.title.trim())
                .slice(0, 6)
                .map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <Check size={12} className="mt-0.5 shrink-0 text-[#A6815C]" aria-hidden />
                    <span className="font-semibold">{b.title}</span>
                  </li>
                ))}
            </ul>
          </div>
        </aside>
      </div>

      <AlertDialog open={pendingPatch !== null} onOpenChange={(o) => !o && setPendingPatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar as alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Muda: {pendingPatch ? (Object.keys(pendingPatch) as Array<keyof PlanPatch>).map((k) => PATCH_LABEL[k]).join(", ") : ""}.
              {pendingPatch?.pro_price_cents !== undefined
                ? ` O novo preço (${formatBRL(pendingPatch.pro_price_cents)}) vale para pedidos novos; pedidos pendentes mantêm o valor original.`
                : ""}{" "}
              A alteração entra na auditoria e aparece no site imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={save}>Publicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
