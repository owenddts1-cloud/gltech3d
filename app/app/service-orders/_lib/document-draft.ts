/**
 * Núcleo puro do gerador de documentos: monta o rascunho, recalcula totais e
 * aplica os padrões da organização.
 *
 * Tudo aqui é função pura sem I/O — é o que permite testar a aritmética de
 * dinheiro (a parte que erra silencioso) sem subir banco nem renderizar React.
 * O servidor recalcula os totais com `recomputeTotals` antes de gravar, então esta
 * é também a definição autoritativa de "quanto dá".
 */
import type { DocumentBranding } from "@/lib/schemas/settings";
import {
  type DocItemInput,
  type DocType,
  type DocTotals,
  type DocumentSnapshot,
  documentSnapshotSchema,
} from "@/lib/schemas/service-order-documents";
import { centsToWordsPtBr } from "@/lib/format/money";
import { addDaysIso } from "@/lib/format/document";

// ─────────────────────────────────────────────────────────────────────────────
// Formato do contexto vindo de fetchDocumentContext()
// ─────────────────────────────────────────────────────────────────────────────

export interface DraftOrder {
  id: string;
  code: string | null;
  title: string;
  contactId: string | null;
  contactName: string | null;
  status: string;
  material: string | null;
  qty: number;
  totalCents: number;
  slaDueAt: string | null;
  createdAt: string;
  notes: string;
  slicerNotes?: {
    notes?: string;
    layerHeight?: number | string;
    infill?: number | string;
    supports?: boolean | string;
  };
}

export interface DraftItem extends DocItemInput {
  id: string | null;
}

export interface DraftContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  documentNumber: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  district: string;
  city: string;
  state: string;
  cep: string;
}

export interface DraftProduct {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  salePriceCents: number | null;
  material: string;
}

export interface DraftOrg {
  displayName: string;
  legalName: string;
  cnpj: string;
  branding: DocumentBranding;
}

export interface DocumentContext {
  order: DraftOrder;
  items: DraftItem[];
  contact: DraftContact | null;
  products: DraftProduct[];
  org: DraftOrg;
  issuedBy: { userId: string | null; name: string };
  nowIso: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aritmética
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soma dos itens menos desconto mais frete, tudo em centavos inteiros.
 *
 * A multiplicação `qty * unitPriceCents` pode gerar fração quando a quantidade é
 * fracionada (ex.: 1,5 m de filamento). Arredonda-se **por item** e não no final,
 * para que o total bata com a soma das linhas impressas — documento em que o
 * rodapé não fecha com a tabela é documento que o cliente contesta.
 */
export function lineTotalCents(item: Pick<DocItemInput, "qty" | "unitPriceCents">): number {
  return Math.round(item.qty * item.unitPriceCents);
}

export function recomputeTotals(
  items: ReadonlyArray<Pick<DocItemInput, "qty" | "unitPriceCents">>,
  opts: { discountCents?: number; shippingCents?: number } = {},
): DocTotals {
  const subtotalCents = items.reduce((acc, item) => acc + lineTotalCents(item), 0);
  const shippingCents = Math.max(0, Math.round(opts.shippingCents ?? 0));
  // Desconto nunca pode ultrapassar subtotal + frete: total negativo não existe e
  // o CHECK `total_cents >= 0` da tabela rejeitaria a emissão.
  const discountCents = Math.min(
    Math.max(0, Math.round(opts.discountCents ?? 0)),
    subtotalCents + shippingCents,
  );
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents - discountCents,
  };
}

/** `true` quando o header da O.S. divergiu da soma dos itens (edição via Vendas/Controle). */
export function snapshotDiffersFromOrderTotal(
  items: ReadonlyArray<Pick<DocItemInput, "qty" | "unitPriceCents">>,
  orderTotalCents: number,
): boolean {
  if (items.length === 0) return false;
  return recomputeTotals(items).subtotalCents !== orderTotalCents;
}

// ─────────────────────────────────────────────────────────────────────────────
// Montagem do rascunho
// ─────────────────────────────────────────────────────────────────────────────

/** Item pré-preenchido a partir de um produto do catálogo. */
export function itemFromProduct(product: DraftProduct): DraftItem {
  return {
    id: null,
    productId: product.id,
    name: product.name,
    description: product.description,
    qty: 1,
    unitPriceCents: product.salePriceCents ?? 0,
    imageUrl: product.imageUrl,
  };
}

/**
 * O.S. legada não tem itens. Em vez de abrir um documento vazio, semeia uma linha
 * a partir do próprio cabeçalho — assim qualquer O.S. já lançada gera documento
 * decente sem obrigar o usuário a cadastrar itens antes.
 */
export function seedItemFromOrder(order: DraftOrder): DraftItem {
  const qty = order.qty > 0 ? order.qty : 1;
  return {
    id: null,
    productId: null,
    name: order.title || "Serviço de Impressão e Modelagem 3D",
    description: "",
    qty,
    unitPriceCents: Math.round(order.totalCents / qty),
    imageUrl: null,
  };
}

/**
 * Termos iniciais do documento.
 *
 * Garantia, prazo de entrega e condições de pagamento saem **exclusivamente** dos
 * Ajustes da organização. São compromissos contratuais: injetar um texto padrão
 * do código faria o documento prometer ao cliente, em nome da empresa, uma
 * garantia dimensional ou um prazo que ninguém acordou. Vazio aqui significa que
 * o bloco não é impresso — e a tela de Ajustes oferece o texto sugerido para o
 * usuário aceitar de propósito.
 *
 * `productionNotes` também começa vazio e é digitado por O.S. no editor.
 */
export function defaultTermsFor(_type: DocType, branding: DocumentBranding) {
  return {
    validityDays: branding.default_validity_days,
    deliveryEstimate: branding.default_delivery_estimate,
    warranty: branding.default_warranty,
    paymentConditions: branding.default_payment_terms,
    productionNotes: "",
    notes: branding.default_notes,
  };
}

function emptyAddress() {
  return { street: "", number: "", complement: "", district: "", city: "", state: "", cep: "" };
}

/**
 * Formatadores dos parâmetros de fatiamento para a folha impressa.
 *
 * `slicer_notes` guarda número (mm), inteiro (%) e booleano; o snapshot guarda
 * texto pronto para imprimir. A ponte precisa distinguir "não informado" de
 * "informado como zero/false" — `0%` de preenchimento e `Não` para suportes são
 * respostas legítimas e vão para o papel; ausência não vai.
 */
export function formatLayerHeight(v: number | string | undefined | null): string {
  if (v == null || v === "") return "";
  return typeof v === "number" ? `${v} mm` : String(v).trim();
}

export function formatInfill(v: number | string | undefined | null): string {
  if (v == null || v === "") return "";
  return typeof v === "number" ? `${v}%` : String(v).trim();
}

export function formatSupports(v: boolean | string | undefined | null): string {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v).trim();
}

/**
 * Monta o rascunho completo. É o estado inicial do editor — daqui em diante o
 * usuário edita campo a campo e nada mais é derivado automaticamente, exceto os
 * totais.
 */
export function buildDraftSnapshot(ctx: DocumentContext, docType: DocType): DocumentSnapshot {
  const items: DocItemInput[] =
    ctx.items.length > 0
      ? ctx.items.map(({ id: _id, ...item }) => item)
      : [(({ id: _id, ...item }) => item)(seedItemFromOrder(ctx.order))];

  const totals = recomputeTotals(items);
  const b = ctx.org.branding;

  const defaultDesc =
    docType === "orcamento"
      ? ctx.order.notes || "Serviço de criação, modelagem tridimensional e prototipagem de alta definição de artes e objetos personalizados em 3D."
      : docType === "ordem_servico"
        ? ctx.order.notes || "Autorização para fabricação e prototipagem tridimensional conforme especificações de arquivos e maquetes virtuais aprovadas pelo contratante."
        : ctx.order.notes || "Termo de quitação financeira relativo aos produtos e serviços de manufatura digital discriminados nesta Ordem de Serviço.";

  return documentSnapshotSchema.parse({
    version: 1,
    docType,
    issuedAt: ctx.nowIso,
    org: {
      displayName: ctx.org.displayName,
      legalName: ctx.org.legalName,
      cnpj: ctx.org.cnpj,
      logoUrl: b.logo_url,
      phone: b.phone,
      email: b.email,
      site: b.site,
      instagram: b.instagram,
      address: b.address,
      footerNote: b.footer_note,
    },
    customer: ctx.contact
      ? {
          contactId: ctx.contact.id,
          name: ctx.contact.name,
          contactPerson: "",
          documentNumber: ctx.contact.documentNumber,
          email: ctx.contact.email,
          phone: ctx.contact.phone,
          address: {
            street: ctx.contact.address,
            number: ctx.contact.addressNumber,
            complement: ctx.contact.addressComplement,
            district: ctx.contact.district,
            city: ctx.contact.city,
            state: ctx.contact.state,
            cep: ctx.contact.cep,
          },
        }
      : {
          contactId: null,
          name: ctx.order.contactName ?? "",
          contactPerson: "",
          documentNumber: "",
          email: "",
          phone: "",
          address: emptyAddress(),
        },
    serviceOrder: {
      id: ctx.order.id,
      code: ctx.order.code,
      title: ctx.order.title,
      status: ctx.order.status,
      material: ctx.order.material ?? "",
      slaDueAt: ctx.order.slaDueAt,
      createdAt: ctx.order.createdAt,
      // Só o que existe de verdade na O.S. Vazio fica vazio — a folha omite a
      // linha. Testar por truthiness aqui era duplamente errado: além de fabricar
      // "0.20 mm"/"15%" quando não havia dado, `infill: 0` e `layerHeight: 0` são
      // valores válidos que caíam no falso, e `supports` indefinido virava "Não".
      layerHeight: formatLayerHeight(ctx.order.slicerNotes?.layerHeight),
      infill: formatInfill(ctx.order.slicerNotes?.infill),
      supports: formatSupports(ctx.order.slicerNotes?.supports),
    },
    items,
    totals,
    payment: {
      method: "pix",
      methodNote: "",
      installments: 1,
      paidAt: docType === "recibo" ? ctx.nowIso.slice(0, 10) : null,
      amountInWords: centsToWordsPtBr(totals.totalCents),
    },
    terms: defaultTermsFor(docType, b),
    signature: {
      showLines: true,
      signerName: b.signer_name,
      signerRole: b.signer_role,
      city: b.address.city,
    },
    options: {
      showItemPhotos: docType !== "recibo",
      photoDisplayMode: "table",
      showUnitPrices: true,
      showFooterNote: true,
    },
    description: defaultDesc,
    heroImageUrl: null,
    meta: {
      emittedByUserId: ctx.issuedBy.userId,
      emittedByName: ctx.issuedBy.name,
    },
  });
}

/**
 * Reaplica ao snapshot tudo que é derivado: totais das linhas, valor por extenso e
 * as opções que dependem do tipo. Chamado a cada edição no editor E de novo no
 * servidor antes de gravar.
 */
export function withDerivedFields(snapshot: DocumentSnapshot): DocumentSnapshot {
  const totals = recomputeTotals(snapshot.items, {
    discountCents: snapshot.totals.discountCents,
    shippingCents: snapshot.totals.shippingCents,
  });
  return {
    ...snapshot,
    totals,
    payment: { ...snapshot.payment, amountInWords: centsToWordsPtBr(totals.totalCents) },
  };
}

/** Data de validade da proposta, derivada de `issuedAt + validityDays`. */
export function validUntil(snapshot: DocumentSnapshot): string {
  if (snapshot.terms.validityDays <= 0) return "";
  return addDaysIso(snapshot.issuedAt, snapshot.terms.validityDays);
}
