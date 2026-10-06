/**
 * Zod schemas for custom calendar events (`calendar_events`, migration 0044).
 * Service-order events are derived from service_orders and never pass here.
 */
import { z } from "zod";

export const CALENDAR_EVENT_TYPES = ["maintenance", "meeting", "delivery", "custom"] as const;
export const calendarEventTypeSchema = z.enum(CALENDAR_EVENT_TYPES);

export const calendarEventCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)."),
  type: calendarEventTypeSchema,
  printerName: z.string().trim().max(120).optional().default(""),
  contactName: z.string().trim().max(120).optional().default(""),
});

/**
 * Editing an event is a full replace, not a partial patch: `printer_name` and
 * `contact_name` only make sense for a given `type`, so a patch without the type
 * could leave a printer attached to a meeting. The edit dialog always sends the
 * whole form.
 */
export const calendarEventUpdateSchema = calendarEventCreateSchema;

export type CalendarEventInput = z.infer<typeof calendarEventCreateSchema>;

/** Columns written for an event; printer/contact are cleared when the type does not use them. */
export function calendarEventToRow(d: CalendarEventInput) {
  return {
    title: d.title,
    description: d.description || null,
    event_date: d.date,
    type: d.type,
    printer_name: d.type === "maintenance" ? d.printerName || null : null,
    contact_name: d.type === "meeting" ? d.contactName || null : null,
  };
}
