"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { readDocumentBranding } from "@/lib/schemas/settings";
import {
  documentSnapshotSchema,
  emitDocumentSchema,
  voidDocumentSchema,
  contactAddressSchema,
  type DocType,
  type DocumentSnapshot,
  type RenderableDocument,
} from "@/lib/schemas/service-order-documents";
import {
  withDerivedFields,
  type DocumentContext,
  type DraftContact,
  type DraftItem,
  type DraftProduct,
} from "@/app/app/service-orders/_lib/document-draft";

/**
 * Emissão de documentos a partir de uma O.S. (migration 0068).
 *
 * O `snapshot` gravado é auto-suficiente: a rota de impressão não faz join nenhum.
 * Isso é o que garante que renomear a empresa, mudar o endereço do cliente ou
 * apagar um produto não altere um documento já entregue ao cliente. A tabela tem
 * trigger de freeze — depois de gravado, só cancelamento muda.
 *
 * Audit sai pelas triggers `trg_service_order_documents_audit` /
 * `trg_service_order_items_audit`, mesmo padrão do resto do módulo de O.S.
 */

async function ctx() {
  const authUser = await loadAuthUser();
  if (!authUser) return null;
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return null;
  return { authUser, orgId: activeOrg.orgId, supabase: await createClient() };
}

export interface DocumentListEntry {
  id: string;
  docType: DocType;
  number: string;
  issuedAt: string;
  totalCents: number;
  voidedAt: string | null;
  voidReason: string | null;
}

interface DocRow {
  id: string;
  doc_type: DocType;
  number: string;
  issued_at: string;
  total_cents: number | string;
  voided_at: string | null;
  void_reason: string | null;
}

function mapDocRow(r: DocRow): DocumentListEntry {
  return {
    id: r.id,
    docType: r.doc_type,
    number: r.number,
    issuedAt: r.issued_at,
    totalCents: Number(r.total_cents ?? 0),
    voidedAt: r.voided_at,
    voidReason: r.void_reason,
  };
}

const DOC_LIST_COLUMNS = "id, doc_type, number, issued_at, total_cents, voided_at, void_reason";

/** Tudo que o editor precisa para montar o rascunho, em um único round-trip. */
export async function fetchDocumentContext(serviceOrderId: string) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  const { data: orderRow, error: orderErr } = await c.supabase
    .from("service_orders")
    .select("id, code, title, contact_id, contact_name, status, material, qty, total_cents, sla_due_at, created_at, slicer_notes")
    .eq("organization_id", c.orgId)
    .eq("id", serviceOrderId)
    .maybeSingle();
  if (orderErr) return { ok: false as const, error: orderErr.message };
  if (!orderRow) return { ok: false as const, error: "O.S. não encontrada" };

  const [itemsRes, contactRes, productsRes, orgRes, docsRes] = await Promise.all([
    c.supabase
      .from("service_order_items")
      .select("id, product_id, name, description, qty, unit_price_cents, image_url, sort_order")
      .eq("organization_id", c.orgId)
      .eq("service_order_id", serviceOrderId)
      .order("sort_order", { ascending: true }),
    orderRow.contact_id
      ? c.supabase
          .from("contacts")
          .select(
            "id, name, display_name, email, phone_number, document_number, address, address_number, address_complement, district, city, state, cep",
          )
          .eq("organization_id", c.orgId)
          .eq("id", orderRow.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    c.supabase
      .from("products")
      .select("id, name, description, images, sale_price_cents, material")
      .eq("organization_id", c.orgId)
      .order("name", { ascending: true })
      .limit(300),
    c.supabase
      .from("organizations")
      .select("display_name, legal_name, cnpj, settings")
      .eq("id", c.orgId)
      .maybeSingle(),
    c.supabase
      .from("service_order_documents")
      .select(DOC_LIST_COLUMNS)
      .eq("organization_id", c.orgId)
      .eq("service_order_id", serviceOrderId)
      .order("issued_at", { ascending: false }),
  ]);

  if (itemsRes.error) return { ok: false as const, error: itemsRes.error.message };
  if (orgRes.error) return { ok: false as const, error: orgRes.error.message };

  const slicer = (orderRow.slicer_notes ?? {}) as { notes?: string };

  const items: DraftItem[] = (itemsRes.data ?? []).map((r) => ({
    id: r.id,
    productId: r.product_id,
    name: r.name,
    description: r.description ?? "",
    qty: Number(r.qty ?? 1),
    unitPriceCents: Number(r.unit_price_cents ?? 0),
    imageUrl: r.image_url,
  }));

  const cr = contactRes.data as Record<string, string | null> | null;
  const contact: DraftContact | null = cr
    ? {
        id: String(cr.id),
        name: cr.display_name || cr.name || orderRow.contact_name || "",
        email: cr.email ?? "",
        phone: cr.phone_number ?? "",
        documentNumber: cr.document_number ?? "",
        address: cr.address ?? "",
        addressNumber: cr.address_number ?? "",
        addressComplement: cr.address_complement ?? "",
        district: cr.district ?? "",
        city: cr.city ?? "",
        state: cr.state ?? "",
        cep: cr.cep ?? "",
      }
    : null;

  const products: DraftProduct[] = (productsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    // products.images é jsonb de string[] com URLs públicas do bucket landing-media.
    imageUrl: Array.isArray(p.images) ? ((p.images as unknown[])[0] as string | undefined) ?? null : null,
    salePriceCents: p.sale_price_cents === null ? null : Number(p.sale_price_cents),
    material: p.material ?? "",
  }));

  const context: DocumentContext = {
    order: {
      id: orderRow.id,
      code: orderRow.code,
      title: orderRow.title,
      contactId: orderRow.contact_id,
      contactName: orderRow.contact_name,
      status: orderRow.status,
      material: orderRow.material,
      qty: Number(orderRow.qty ?? 1),
      totalCents: Number(orderRow.total_cents ?? 0),
      slaDueAt: orderRow.sla_due_at,
      createdAt: orderRow.created_at,
      notes: slicer.notes ?? "",
    },
    items,
    contact,
    products,
    org: {
      displayName: orgRes.data?.display_name ?? "",
      legalName: orgRes.data?.legal_name ?? "",
      cnpj: orgRes.data?.cnpj ?? "",
      branding: readDocumentBranding(orgRes.data?.settings),
    },
    issuedBy: {
      userId: c.authUser.id,
      name: c.authUser.full_name ?? c.authUser.email,
    },
    nowIso: new Date().toISOString(),
  };

  return {
    ok: true as const,
    context,
    documents: ((docsRes.data as DocRow[] | null) ?? []).map(mapDocRow),
  };
}

export async function listServiceOrderDocuments(serviceOrderId: string) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  const { data, error } = await c.supabase
    .from("service_order_documents")
    .select(DOC_LIST_COLUMNS)
    .eq("organization_id", c.orgId)
    .eq("service_order_id", serviceOrderId)
    .order("issued_at", { ascending: false });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, documents: ((data as DocRow[] | null) ?? []).map(mapDocRow) };
}

/** Carrega um documento emitido para impressão. Valida o snapshot na LEITURA também. */
export async function fetchServiceOrderDocument(
  id: string,
): Promise<{ ok: true; document: RenderableDocument } | { ok: false; error: string }> {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  const { data, error } = await c.supabase
    .from("service_order_documents")
    .select("id, number, snapshot, voided_at, void_reason")
    .eq("organization_id", c.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "Documento não encontrado" };

  const parsed = documentSnapshotSchema.safeParse(data.snapshot);
  if (!parsed.success) {
    // Snapshot fora do contrato = documento gravado por uma versão incompatível.
    // Falhar aqui é melhor do que imprimir uma folha meio renderizada.
    return { ok: false as const, error: "Snapshot do documento é inválido ou de outra versão." };
  }

  return {
    ok: true as const,
    document: {
      snapshot: parsed.data,
      number: data.number,
      voidedAt: data.voided_at,
      voidReason: data.void_reason,
    },
  };
}

export async function emitServiceOrderDocument(raw: unknown) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  const parsed = emitDocumentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Documento inválido" };
  const { serviceOrderId, docType } = parsed.data;

  const { data: order, error: orderErr } = await c.supabase
    .from("service_orders")
    .select("id")
    .eq("organization_id", c.orgId)
    .eq("id", serviceOrderId)
    .maybeSingle();
  if (orderErr) return { ok: false as const, error: orderErr.message };
  if (!order) return { ok: false as const, error: "O.S. não encontrada" };

  // Recalcula totais e valor por extenso no SERVIDOR: aritmética de dinheiro vinda
  // do browser não é confiável, e o snapshot é imutável depois de gravado.
  const snapshot: DocumentSnapshot = withDerivedFields({
    ...parsed.data.snapshot,
    docType,
    issuedAt: new Date().toISOString(),
    serviceOrder: { ...parsed.data.snapshot.serviceOrder, id: serviceOrderId },
    meta: {
      emittedByUserId: c.authUser.id,
      emittedByName: c.authUser.full_name ?? c.authUser.email,
    },
  });

  const { data, error } = await c.supabase
    .from("service_order_documents")
    .insert({
      organization_id: c.orgId,
      service_order_id: serviceOrderId,
      doc_type: docType,
      snapshot,
      total_cents: snapshot.totals.totalCents,
      issued_at: snapshot.issuedAt,
      issued_by: c.authUser.id,
    })
    // number / seq / doc_year vêm da trigger fn_assign_document_number.
    .select("id, number")
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/service-orders");
  revalidatePath(`/app/service-orders/${serviceOrderId}/documentos`);
  return { ok: true as const, id: data.id as string, number: data.number as string };
}

/**
 * Cancela um documento. Não apaga: o histórico é a razão de a tabela existir — a
 * reimpressão passa a sair com tarja "CANCELADO".
 */
export async function voidServiceOrderDocument(raw: unknown) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  const parsed = voidDocumentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Motivo do cancelamento é obrigatório" };

  const { error } = await c.supabase
    .from("service_order_documents")
    .update({ voided_at: new Date().toISOString(), void_reason: parsed.data.reason })
    .eq("organization_id", c.orgId)
    .eq("id", parsed.data.id)
    .is("voided_at", null);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/service-orders");
  return { ok: true as const };
}

/** Grava no cadastro do cliente o endereço digitado no editor do documento. */
export async function updateContactAddress(contactId: string, raw: unknown) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Não autenticado" };

  const parsed = contactAddressSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Endereço inválido" };

  const blank = (v: string | null) => (v && v.trim() ? v.trim() : null);
  const { error } = await c.supabase
    .from("contacts")
    .update({
      document_number: blank(parsed.data.document_number),
      address: blank(parsed.data.address),
      address_number: blank(parsed.data.address_number),
      address_complement: blank(parsed.data.address_complement),
      district: blank(parsed.data.district),
      city: blank(parsed.data.city),
      state: blank(parsed.data.state)?.toUpperCase() ?? null,
      cep: blank(parsed.data.cep),
    })
    .eq("organization_id", c.orgId)
    .eq("id", contactId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/contacts");
  return { ok: true as const };
}
