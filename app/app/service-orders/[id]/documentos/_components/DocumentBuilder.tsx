"use client";

/**
 * Editor de documentos de uma O.S.
 *
 * Duas colunas: à esquerda o formulário, à direita a MESMA folha que vai para a
 * impressora (`<DocumentSheet>`), reduzida com `transform: scale`. Não existe um
 * "layout de preview" separado — o que se vê é o que sai, e é por isso que o
 * renderizador é um componente puro compartilhado com a rota `/documentos/[id]`.
 *
 * Trocar de aba (Orçamento / O.S. / Recibo) só troca o `docType` do rascunho:
 * itens, cliente e valores são os mesmos, o que muda é o que cada documento
 * mostra. Os totais nunca são digitados — `withDerivedFields` recalcula a cada
 * edição, e o servidor recalcula de novo antes de gravar.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DocumentSheet } from "@/components/documents/DocumentSheet";
import { ArrowLeft, FloppyDisk, Printer, Warning } from "@/lib/ui/icons";
import { brlFromCents, brlNumberFromCents, centsFromInput } from "@/lib/format/money";
import {
  DOC_TYPES,
  DOC_TYPE_SHORT,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type DocType,
  type DocumentSnapshot,
} from "@/lib/schemas/service-order-documents";
import {
  buildDraftSnapshot,
  snapshotDiffersFromOrderTotal,
  withDerivedFields,
  type DocumentContext,
} from "@/app/app/service-orders/_lib/document-draft";
import {
  emitServiceOrderDocument,
  type DocumentListEntry,
} from "@/app/actions/service-orders/documents";
import {
  recalcServiceOrderTotalFromItems,
  saveServiceOrderItems,
} from "@/app/actions/service-orders/items";

import { DocumentHistory } from "./DocumentHistory";
import { ItemsEditor } from "./ItemsEditor";
import { PartyFields } from "./PartyFields";
import { ItemPhotoField } from "./ItemPhotoField";

interface Props {
  context: DocumentContext;
  initialDocuments: DocumentListEntry[];
  initialDocType: DocType;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">{title}</h2>
      {children}
    </section>
  );
}

/** Campo de texto do bloco de empresa. */
function OrgField({
  id,
  label,
  value,
  onChange,
  className,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  maxLength?: number;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg text-xs"
      />
    </div>
  );
}

export function DocumentBuilder({ context, initialDocuments, initialDocType }: Props) {
  const router = useRouter();
  const [docType, setDocType] = useState<DocType>(initialDocType);
  const [draft, setDraft] = useState<DocumentSnapshot>(() =>
    buildDraftSnapshot(context, initialDocType),
  );
  const [documents, setDocuments] = useState(initialDocuments);
  const [orderTotalCents, setOrderTotalCents] = useState(context.order.totalCents);
  const [savingItems, startSavingItems] = useTransition();
  const [emitting, startEmitting] = useTransition();

  const update = useCallback((patch: Partial<DocumentSnapshot>) => {
    setDraft((prev) => withDerivedFields({ ...prev, ...patch }));
  }, []);

  const setOrg = useCallback((patch: Partial<DocumentSnapshot["org"]>) => {
    setDraft((prev) => withDerivedFields({ ...prev, org: { ...prev.org, ...patch } }));
  }, []);

  const setOrgAddress = useCallback((patch: Partial<DocumentSnapshot["org"]["address"]>) => {
    setDraft((prev) =>
      withDerivedFields({ ...prev, org: { ...prev.org, address: { ...prev.org.address, ...patch } } }),
    );
  }, []);

  /** Descarta as edições locais de empresa e volta ao que está nos Ajustes. */
  const restoreOrgFromSettings = useCallback(() => {
    setDraft((prev) => withDerivedFields({ ...prev, org: buildDraftSnapshot(context, prev.docType).org }));
    toast.success("Dados da empresa restaurados dos Ajustes");
  }, [context]);

  /**
   * Trocar de tipo reaproveita tudo que já foi editado (itens, cliente, valores) e
   * reaplica só o que é específico do tipo — perder o trabalho a cada clique de aba
   * seria inaceitável.
   */
  function switchType(next: DocType) {
    setDocType(next);
    setDraft((prev) =>
      withDerivedFields({
        ...prev,
        docType: next,
        payment: {
          ...prev.payment,
          paidAt: next === "recibo" ? (prev.payment.paidAt ?? new Date().toISOString().slice(0, 10)) : prev.payment.paidAt,
        },
        options: { ...prev.options, showItemPhotos: next === "recibo" ? false : prev.options.showItemPhotos },
      }),
    );
    router.replace(`/app/service-orders/${context.order.id}/documentos?tipo=${next}`, { scroll: false });
  }

  // O total da O.S. pode divergir da soma dos itens quando alguém edita o valor
  // pela tela de Vendas ou do Controle — as triggers 0065/0066 escrevem
  // `service_orders.total_cents` direto. A divergência fica visível e corrigível
  // em vez de silenciosa.
  const diverges = useMemo(
    () => context.items.length > 0 && snapshotDiffersFromOrderTotal(draft.items, orderTotalCents),
    [context.items.length, draft.items, orderTotalCents],
  );

  function saveItems() {
    startSavingItems(async () => {
      const res = await saveServiceOrderItems({
        serviceOrderId: context.order.id,
        items: draft.items.map((item) => ({ ...item, id: null })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOrderTotalCents(res.orderTotalCents);
      toast.success("Itens salvos na O.S.");
      router.refresh();
    });
  }

  function recalc() {
    startSavingItems(async () => {
      const res = await recalcServiceOrderTotalFromItems(context.order.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOrderTotalCents(res.totalCents);
      toast.success("Total da O.S. recalculado pelos itens");
      router.refresh();
    });
  }

  function emit() {
    if (draft.items.length === 0) {
      toast.error("Adicione ao menos um item antes de emitir.");
      return;
    }
    if (draft.items.some((i) => !i.name.trim())) {
      toast.error("Todo item precisa de uma descrição.");
      return;
    }
    startEmitting(async () => {
      const res = await emitServiceOrderDocument({
        serviceOrderId: context.order.id,
        docType,
        snapshot: draft,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${DOC_TYPE_SHORT[docType]} ${res.number} emitido`);
      window.open(`/documentos/${res.id}?auto=1`, "_blank", "noopener");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      {/* ── Formulário ───────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1 space-y-4 xl:max-w-xl">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg text-xs"
            onClick={() => router.push("/app/service-orders")}
          >
            <ArrowLeft size={14} className="mr-1" /> Ordens de Serviço
          </Button>
          <span className="text-xs text-text-muted">
            {context.order.code ?? "O.S."} · {context.order.title}
          </span>
        </div>

        <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          {DOC_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchType(t)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                docType === t
                  ? "bg-accent text-white"
                  : "text-text-muted hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              {DOC_TYPE_SHORT[t]}
            </button>
          ))}
        </div>

        {diverges ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning bg-warning-bg px-3 py-2 text-xs text-warning-fg">
            <Warning size={14} className="shrink-0" />
            <span className="flex-1">
              O total da O.S. ({brlFromCents(orderTotalCents)}) difere da soma dos itens (
              {brlFromCents(draft.totals.subtotalCents)}). Alguém editou o valor pela tela de Vendas
              ou do Controle.
            </span>
            <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px]" onClick={recalc}>
              Recalcular pelos itens
            </Button>
          </div>
        ) : null}

        <Section title="Itens">
          <ItemsEditor
            items={draft.items}
            products={context.products}
            showPhotos={draft.options.showItemPhotos}
            onChange={(items) => update({ items })}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-lg text-xs"
            onClick={saveItems}
            disabled={savingItems}
          >
            <FloppyDisk size={14} className="mr-1" />
            {savingItems ? "Salvando…" : "Salvar itens na O.S."}
          </Button>
          <p className="text-[11px] text-text-muted">
            Salvar grava os itens na Ordem de Serviço e recalcula o valor dela — o documento pode ser
            emitido sem salvar, mas aí os itens ficam só no documento.
          </p>
        </Section>

        <Section title="Dados da Empresa (Cabeçalho & Rodapé)">
          <p className="text-[11px] text-text-muted">
            O padrão vem de <strong>Ajustes → Organização → Documentos impressos</strong>. O que
            você mudar aqui vale só para este documento. Campo em branco não é impresso — o
            sistema não preenche com dado de exemplo.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <OrgField id="doc-org-name" label="Nome da empresa" value={draft.org.displayName} onChange={(v) => setOrg({ displayName: v })} />
            <OrgField id="doc-org-legal" label="Razão social" value={draft.org.legalName} onChange={(v) => setOrg({ legalName: v })} />
            <OrgField id="doc-org-cnpj" label="CNPJ" value={draft.org.cnpj} onChange={(v) => setOrg({ cnpj: v })} />
            <OrgField id="doc-org-phone" label="Telefone" value={draft.org.phone} onChange={(v) => setOrg({ phone: v })} />
            <OrgField id="doc-org-email" label="E-mail" value={draft.org.email} onChange={(v) => setOrg({ email: v })} />
            <OrgField id="doc-org-site" label="Site" value={draft.org.site} onChange={(v) => setOrg({ site: v })} />
            <OrgField id="doc-org-instagram" label="Instagram" value={draft.org.instagram} onChange={(v) => setOrg({ instagram: v })} />
            <OrgField id="doc-org-footer" label="Nota de rodapé" value={draft.org.footerNote} onChange={(v) => setOrg({ footerNote: v })} />
          </div>

          <div className="grid grid-cols-6 gap-3">
            <OrgField className="col-span-4" id="doc-org-street" label="Endereço" value={draft.org.address.street} onChange={(v) => setOrgAddress({ street: v })} />
            <OrgField className="col-span-2" id="doc-org-number" label="Número" value={draft.org.address.number} onChange={(v) => setOrgAddress({ number: v })} />
            <OrgField className="col-span-3" id="doc-org-district" label="Bairro" value={draft.org.address.district} onChange={(v) => setOrgAddress({ district: v })} />
            <OrgField className="col-span-3" id="doc-org-city" label="Cidade" value={draft.org.address.city} onChange={(v) => setOrgAddress({ city: v })} />
            <OrgField className="col-span-1" id="doc-org-state" label="UF" maxLength={2} value={draft.org.address.state} onChange={(v) => setOrgAddress({ state: v.toUpperCase().slice(0, 2) })} />
            <OrgField className="col-span-2" id="doc-org-cep" label="CEP" value={draft.org.address.cep} onChange={(v) => setOrgAddress({ cep: v })} />
          </div>

          <div className="space-y-1.5">
            <Label>Logotipo</Label>
            <ItemPhotoField
              value={draft.org.logoUrl || null}
              onChange={(logoUrl) => setOrg({ logoUrl: logoUrl ?? "" })}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-lg text-xs"
            onClick={restoreOrgFromSettings}
          >
            Restaurar dados dos Ajustes
          </Button>
        </Section>

        <Section title="Cliente">
          <PartyFields
            customer={draft.customer}
            contact={context.contact}
            onChange={(customer) => update({ customer })}
          />
        </Section>

        <Section title="Valores">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="doc-discount">Desconto (R$)</Label>
              <Input
                id="doc-discount"
                inputMode="decimal"
                defaultValue={brlNumberFromCents(draft.totals.discountCents)}
                onChange={(e) =>
                  update({
                    totals: { ...draft.totals, discountCents: centsFromInput(e.target.value) },
                  })
                }
                className="h-9 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-shipping">Frete (R$)</Label>
              <Input
                id="doc-shipping"
                inputMode="decimal"
                defaultValue={brlNumberFromCents(draft.totals.shippingCents)}
                onChange={(e) =>
                  update({
                    totals: { ...draft.totals, shippingCents: centsFromInput(e.target.value) },
                  })
                }
                className="h-9 rounded-lg text-xs"
              />
            </div>
          </div>
          <p className="text-right text-sm font-bold text-foreground">
            Total: {brlFromCents(draft.totals.totalCents)}
          </p>
        </Section>

        {docType === "recibo" ? (
          <Section title="Pagamento">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="doc-method">Forma de pagamento</Label>
                <Combobox
                  id="doc-method"
                  className="h-9 rounded-lg text-xs"
                  value={draft.payment.method}
                  onChange={(v) =>
                    update({ payment: { ...draft.payment, method: v as (typeof PAYMENT_METHODS)[number] } })
                  }
                  options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
                  searchPlaceholder="Buscar forma…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-paid-at">Data do recebimento</Label>
                <Input
                  id="doc-paid-at"
                  type="date"
                  value={draft.payment.paidAt?.slice(0, 10) ?? ""}
                  onChange={(e) => update({ payment: { ...draft.payment, paidAt: e.target.value || null } })}
                  className="h-9 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-installments">Parcelas</Label>
                <Input
                  id="doc-installments"
                  inputMode="numeric"
                  value={draft.payment.installments}
                  onChange={(e) =>
                    update({
                      payment: {
                        ...draft.payment,
                        installments: Math.min(60, Math.max(1, Number(e.target.value) || 1)),
                      },
                    })
                  }
                  className="h-9 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-method-note">Detalhe (opcional)</Label>
                <Input
                  id="doc-method-note"
                  value={draft.payment.methodNote}
                  placeholder="Ex.: Pix — chave CNPJ"
                  onChange={(e) => update({ payment: { ...draft.payment, methodNote: e.target.value } })}
                  className="h-9 rounded-lg text-xs"
                />
              </div>
            </div>
          </Section>
        ) : null}

        <Section title="Condições e textos">
          {docType === "orcamento" ? (
            <div className="space-y-1.5">
              <Label htmlFor="doc-validity">Validade da proposta (dias)</Label>
              <Input
                id="doc-validity"
                inputMode="numeric"
                value={draft.terms.validityDays}
                onChange={(e) =>
                  update({
                    terms: {
                      ...draft.terms,
                      validityDays: Math.min(365, Math.max(0, Number(e.target.value) || 0)),
                    },
                  })
                }
                className="h-9 rounded-lg text-xs"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="doc-delivery">
              {docType === "ordem_servico" ? "Prazo de conclusão" : "Prazo de entrega"}
            </Label>
            <Input
              id="doc-delivery"
              value={draft.terms.deliveryEstimate}
              placeholder="Ex.: 60 dias após aprovação"
              onChange={(e) => update({ terms: { ...draft.terms, deliveryEstimate: e.target.value } })}
              className="h-9 rounded-lg text-xs"
            />
          </div>

          {docType === "orcamento" ? (
            <div className="space-y-1.5">
              <Label htmlFor="doc-payment-terms">Condições de pagamento</Label>
              <Textarea
                id="doc-payment-terms"
                value={draft.terms.paymentConditions}
                placeholder="Ex.: 50% na aprovação, 50% na entrega (Pix ou transferência)"
                onChange={(e) => update({ terms: { ...draft.terms, paymentConditions: e.target.value } })}
                className="min-h-[64px] rounded-lg text-xs"
              />
            </div>
          ) : null}

          {docType === "ordem_servico" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="doc-production">Especificações de produção</Label>
                <Textarea
                  id="doc-production"
                  value={draft.terms.productionNotes}
                  placeholder="Altura de camada, preenchimento, suportes, acabamento…"
                  onChange={(e) => update({ terms: { ...draft.terms, productionNotes: e.target.value } })}
                  className="min-h-[64px] rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-warranty">Garantia e termo de aceite</Label>
                <Textarea
                  id="doc-warranty"
                  value={draft.terms.warranty}
                  onChange={(e) => update({ terms: { ...draft.terms, warranty: e.target.value } })}
                  className="min-h-[64px] rounded-lg text-xs"
                />
              </div>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="doc-desc">Descrição geral do serviço</Label>
            <Textarea
              id="doc-desc"
              value={draft.description}
              placeholder="Aparece logo abaixo dos dados do cliente."
              onChange={(e) => update({ description: e.target.value })}
              className="min-h-[64px] rounded-lg text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-notes">Observações</Label>
            <Textarea
              id="doc-notes"
              value={draft.terms.notes}
              placeholder="Ex.: o tom de dourado pode variar conforme a matéria-prima."
              onChange={(e) => update({ terms: { ...draft.terms, notes: e.target.value } })}
              className="min-h-[64px] rounded-lg text-xs"
            />
          </div>
        </Section>

        {docType === "ordem_servico" ? (
          <Section title="Parâmetros Técnicos de Impressão 3D">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="doc-layer-height">Altura de Camada</Label>
                <Input
                  id="doc-layer-height"
                  value={draft.serviceOrder.layerHeight || ""}
                  placeholder="Ex.: 0.20 mm"
                  onChange={(e) =>
                    update({
                      serviceOrder: { ...draft.serviceOrder, layerHeight: e.target.value },
                    })
                  }
                  className="h-9 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-infill">Preenchimento (Infill)</Label>
                <Input
                  id="doc-infill"
                  value={draft.serviceOrder.infill || ""}
                  placeholder="Ex.: 15% Giroide"
                  onChange={(e) =>
                    update({
                      serviceOrder: { ...draft.serviceOrder, infill: e.target.value },
                    })
                  }
                  className="h-9 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-supports">Suportes</Label>
                <Input
                  id="doc-supports"
                  value={draft.serviceOrder.supports || ""}
                  placeholder="Ex.: Sim (Orgânico/Árvore)"
                  onChange={(e) =>
                    update({
                      serviceOrder: { ...draft.serviceOrder, supports: e.target.value },
                    })
                  }
                  className="h-9 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-material-tech">Matéria-Prima / Cor</Label>
                <Input
                  id="doc-material-tech"
                  value={draft.serviceOrder.material || ""}
                  placeholder="Ex.: PLA Silk Dourado"
                  onChange={(e) =>
                    update({
                      serviceOrder: { ...draft.serviceOrder, material: e.target.value },
                    })
                  }
                  className="h-9 rounded-lg text-xs"
                />
              </div>
            </div>
          </Section>
        ) : null}

        <Section title="Imagem Destaque do Projeto (Cabeçalho)">
          <div className="flex items-center gap-4">
            <ItemPhotoField
              value={draft.heroImageUrl}
              onChange={(heroImageUrl: string | null) => update({ heroImageUrl })}
            />
            <div className="space-y-1 text-xs text-text-muted">
              <p className="font-semibold text-foreground">Foto Hero no Cabeçalho</p>
              <p>
                Aparece no topo do documento (ex: a Rosa Dourada Realista). Use o botão{" "}
                <strong className="text-amber-500 font-semibold">Cortar Fundo</strong> para deixar o fundo
                transparente com IA!
              </p>
            </div>
          </div>
        </Section>

        <Section title="Layout e Posição das Fotos">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="doc-photo-mode">Posição das Fotos nos Itens</Label>
              <Combobox
                id="doc-photo-mode"
                className="h-9 rounded-lg text-xs"
                value={draft.options.photoDisplayMode ?? "table"}
                onChange={(v) =>
                  update({
                    options: {
                      ...draft.options,
                      photoDisplayMode: v as "table" | "gallery" | "both" | "none",
                      showItemPhotos: v !== "none",
                    },
                  })
                }
                options={[
                  { value: "table", label: "Na Tabela de Itens (Coluna Foto)" },
                  { value: "gallery", label: "Galeria Numerada no Rodapé (❶ ❷ ❸)" },
                  { value: "both", label: "Ambas (Tabela + Galeria no Rodapé)" },
                  { value: "none", label: "Sem Fotos (Apenas Texto)" },
                ]}
                searchPlaceholder="Buscar opção…"
              />
            </div>
            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between gap-3 text-xs">
                <span>Mostrar valor unitário</span>
                <Switch
                  checked={draft.options.showUnitPrices}
                  onCheckedChange={(v) => update({ options: { ...draft.options, showUnitPrices: v } })}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-xs">
                <span>Linhas de assinatura</span>
                <Switch
                  checked={draft.signature.showLines}
                  onCheckedChange={(v) => update({ signature: { ...draft.signature, showLines: v } })}
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="doc-signer">Assinante (GLTECH3D)</Label>
                <Input
                  id="doc-signer"
                  value={draft.signature.signerName}
                  onChange={(e) => update({ signature: { ...draft.signature, signerName: e.target.value } })}
                  className="h-9 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-signer-role">Cargo / Função</Label>
                <Input
                  id="doc-signer-role"
                  value={draft.signature.signerRole}
                  onChange={(e) => update({ signature: { ...draft.signature, signerRole: e.target.value } })}
                  className="h-9 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-city">Cidade (local e data)</Label>
                <Input
                  id="doc-city"
                  value={draft.signature.city}
                  onChange={(e) => update({ signature: { ...draft.signature, city: e.target.value } })}
                  className="h-9 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Documentos emitidos">
          <DocumentHistory
            documents={documents}
            onVoided={(id) =>
              setDocuments((prev) =>
                prev.map((d) => (d.id === id ? { ...d, voidedAt: new Date().toISOString() } : d)),
              )
            }
          />
        </Section>
      </div>

      {/* ── Preview ──────────────────────────────────────────────────────── */}
      <PreviewPane draft={draft} onEmit={emit} emitting={emitting} docType={docType} />
    </div>
  );
}

/**
 * A folha em escala. O fator é calculado a partir da largura disponível — a folha
 * tem 210mm fixos, então em telas menores ela precisa encolher em vez de vazar.
 */
function PreviewPane({
  draft,
  onEmit,
  emitting,
  docType,
}: {
  draft: DocumentSnapshot;
  onEmit: () => void;
  emitting: boolean;
  docType: DocType;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const available = entry!.contentRect.width;
      // 210mm ≈ 794px a 96dpi.
      setScale(Math.min(1, Math.max(0.35, (available - 8) / 794)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-w-0 flex-1">
      <div className="sticky top-4 space-y-3">
        <Button
          type="button"
          className="w-full rounded-lg bg-accent text-xs font-semibold text-white hover:bg-accent/90"
          onClick={onEmit}
          disabled={emitting}
        >
          <Printer size={15} className="mr-1.5" />
          {emitting ? "Emitindo…" : `Emitir e imprimir ${DOC_TYPE_SHORT[docType]}`}
        </Button>
        <p className="text-center text-[11px] text-text-muted">
          A emissão congela o documento com um número próprio. Depois disso ele não muda mais — para
          corrigir, emita outro e cancele este.
        </p>

        <div ref={wrapRef} className="overflow-hidden rounded-xl border border-border bg-neutral-500 p-1">
          <div className="doc-frame--scaled" style={{ "--doc-scale": scale } as React.CSSProperties}>
            <DocumentSheet
              document={{ snapshot: draft, number: "PRÉVIA", voidedAt: null, voidReason: null }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
