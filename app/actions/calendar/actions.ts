"use server";

import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * CRUD dos eventos personalizados do calendário (migration 0044).
 * Eventos de OS são derivados de service_orders — não passam por aqui.
 */

export interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  date: string; // YYYY-MM-DD
  type: "maintenance" | "meeting" | "delivery" | "custom";
  printerName: string | null;
  contactName: string | null;
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)."),
  type: z.enum(["maintenance", "meeting", "delivery", "custom"]),
  printerName: z.string().trim().max(120).optional().default(""),
  contactName: z.string().trim().max(120).optional().default(""),
});

interface Ctx {
  orgId: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

async function requireCtx(): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Não autenticado" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "Nenhuma organização ativa" };
  return { ok: true, ctx: { orgId: activeOrg.orgId, userId: authUser.id, supabase: await createClient() } };
}

interface Row {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  type: string;
  printer_name: string | null;
  contact_name: string | null;
}

function toView(r: Row): CalendarEventRow {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    date: r.event_date,
    type: (["maintenance", "meeting", "delivery", "custom"].includes(r.type)
      ? r.type
      : "custom") as CalendarEventRow["type"],
    printerName: r.printer_name,
    contactName: r.contact_name,
  };
}

export async function fetchCalendarEvents() {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { data, error } = await c.ctx.supabase
    .from("calendar_events")
    .select("id, title, description, event_date, type, printer_name, contact_name")
    .order("event_date", { ascending: true });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const, events: ((data as Row[] | null) ?? []).map(toView) };
}

export interface CalendarSaleRow {
  id: string;
  date: string; // YYYY-MM-DD (sold_at)
  customerName: string | null;
  platform: string | null;
  totalCents: number;
}

/**
 * Datas de venda para marcar no calendário (derivado de marketplace_orders — DIRC:
 * não duplica em calendar_events, calcula on-demand como os eventos de OS).
 */
export async function fetchSalesDates() {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { data, error } = await c.ctx.supabase
    .from("marketplace_orders")
    .select("id, sold_at, customer_name, platform, total_cents, status")
    .eq("organization_id", c.ctx.orgId)
    .neq("status", "cancelado")
    .order("sold_at", { ascending: true });
  if (error) return { ok: false as const, error: error.message };

  const sales: CalendarSaleRow[] = ((data as Array<{ id: string; sold_at: string; customer_name: string | null; platform: string | null; total_cents: number | string }> | null) ?? [])
    .map((r) => ({ id: r.id, date: r.sold_at, customerName: r.customer_name, platform: r.platform, totalCents: Number(r.total_cents) || 0 }));

  return { ok: true as const, sales };
}

export async function createCalendarEvent(raw: unknown) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = parsed.data;

  const { data, error } = await c.ctx.supabase
    .from("calendar_events")
    .insert({
      organization_id: c.ctx.orgId,
      title: d.title,
      description: d.description || null,
      event_date: d.date,
      type: d.type,
      printer_name: d.type === "maintenance" ? d.printerName || null : null,
      contact_name: d.type === "meeting" ? d.contactName || null : null,
      created_by: c.ctx.userId,
    })
    .select("id, title, description, event_date, type, printer_name, contact_name")
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/calendar");
  return { ok: true as const, event: toView(data as Row) };
}

export async function deleteCalendarEvent(id: string) {
  const c = await requireCtx();
  if (!c.ok) return { ok: false as const, error: c.error };

  const { error } = await c.ctx.supabase
    .from("calendar_events")
    .delete()
    .eq("organization_id", c.ctx.orgId)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/app/calendar");
  return { ok: true as const };
}
