import type { Lead } from "@/lib/types/leads";

export interface LeadFilters {
  ownerUserId?: string | "any" | "unassigned";
  status?: "all" | "open" | "won" | "lost";
  tag?: string;
  search?: string;
  valueCentsMin?: number | null;
  valueCentsMax?: number | null;
  overdueOnly?: boolean;
}

export function applyFilters(leads: Lead[], f: LeadFilters): Lead[] {
  const today = new Date().toISOString().slice(0, 10);
  const search = f.search?.trim().toLowerCase() ?? "";

  return leads.filter((l) => {
    if (f.ownerUserId === "unassigned" && l.owner_user_id !== null) return false;
    if (
      f.ownerUserId &&
      f.ownerUserId !== "any" &&
      f.ownerUserId !== "unassigned" &&
      l.owner_user_id !== f.ownerUserId
    )
      return false;
    if (f.status && f.status !== "all" && l.status !== f.status) return false;
    if (f.tag && !l.tags.includes(f.tag)) return false;
    if (
      search &&
      !`${l.title} ${l.description ?? ""}`.toLowerCase().includes(search)
    )
      return false;
    if (typeof f.valueCentsMin === "number" && (l.value_cents ?? 0) < f.valueCentsMin)
      return false;
    if (typeof f.valueCentsMax === "number" && (l.value_cents ?? 0) > f.valueCentsMax)
      return false;
    if (f.overdueOnly) {
      if (l.status !== "open") return false;
      if (!l.expected_close_date || l.expected_close_date >= today) return false;
    }
    return true;
  });
}
