"use server";

/**
 * Resumo de CRM de um contato, para o painel lateral do inbox.
 *
 * POR QUE É UMA SERVER ACTION E NÃO UMA QUERY NO BROWSER: o cliente Supabase do
 * browser nunca tem sessão — o cookie de auth é `httpOnly` e ele lê de
 * `document.cookie`. Toda chamada dele chega como `anon`, e com RLS ativa o
 * resultado não é erro: é lista vazia, em silêncio. O painel mostrava "nenhum
 * lead / nenhum pedido" para contatos que tinham ambos.
 *
 * Ver `docs/runbooks/sessao-do-browser.md`.
 */

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";

export interface ContactLeadRow {
  id: string;
  title: string;
  status: string;
  value_cents: number | null;
  currency: string | null;
  updated_at: string;
}

export interface ContactOrderRow {
  id: string;
  external_id: string | null;
  status: string | null;
  total_cents: number | null;
  currency: string | null;
  created_at: string;
}

export interface ContactActivityRow {
  id: string;
  type: string;
  source_module: string;
  performed_at: string;
  payload: Record<string, unknown> | null;
}

const schema = z.object({ contactId: z.string().uuid() });

export async function fetchContactCrmSummary(raw: unknown) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Contato inválido" };

  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false as const, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false as const, error: "Nenhuma organização ativa" };

  const supabase = await createClient();
  const { contactId } = parsed.data;
  // `organization_id` explícito em toda query que cruza tabela tenant-aware
  // (CLAUDE.md), mesmo com RLS ativa — defesa em profundidade.
  const org = activeOrg.orgId;

  const [leadsRes, ordersRes, activitiesRes] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("id, title, status, value_cents, currency, updated_at")
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .order("updated_at", { ascending: false })
      .limit(3),
    supabase
      .from("orders")
      .select("id, external_id, status, total_cents, currency, created_at")
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("crm_lead_activities")
      .select("id, type, source_module, performed_at, payload")
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .order("performed_at", { ascending: false })
      .limit(5),
  ]);

  // Erro vira erro, não lista vazia. Confundir "não há nada" com "não consegui
  // ler" foi exatamente o que manteve este defeito invisível.
  const failure = leadsRes.error ?? ordersRes.error ?? activitiesRes.error;
  if (failure) return { ok: false as const, error: failure.message };

  return {
    ok: true as const,
    leads: (leadsRes.data ?? []) as ContactLeadRow[],
    orders: (ordersRes.data ?? []) as ContactOrderRow[],
    activities: (activitiesRes.data ?? []) as ContactActivityRow[],
  };
}
