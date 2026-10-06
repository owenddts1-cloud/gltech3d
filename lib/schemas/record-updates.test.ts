/**
 * Edit schemas for projects, suppliers and calendar events.
 *
 * The property that matters: a partial patch must NOT re-apply create defaults
 * to keys it did not send (that would silently reset stored columns).
 */
import { describe, expect, it } from "vitest";
import { projectCreateSchema, projectPatchToRow, projectUpdateSchema } from "./projects";
import { supplierPatchToRow, supplierUpdateSchema } from "./suppliers";
import {
  calendarEventCreateSchema,
  calendarEventToRow,
  calendarEventUpdateSchema,
} from "./calendar";

describe("projectUpdateSchema", () => {
  it("keeps only the keys that were sent (no create defaults)", () => {
    const r = projectUpdateSchema.safeParse({ name: "  Foguete  " });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toEqual({ name: "Foguete" });
    expect(projectPatchToRow(r.data)).toEqual({ name: "Foguete" });
  });

  it("rejects an empty patch", () => {
    expect(projectUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("applies the same field rules as create", () => {
    expect(projectUpdateSchema.safeParse({ name: "" }).success).toBe(false);
    expect(projectUpdateSchema.safeParse({ weightGrams: -1 }).success).toBe(false);
    expect(projectUpdateSchema.safeParse({ layerHeight: 6 }).success).toBe(false);
  });

  it("maps a full form to snake_case columns, blanks to null", () => {
    const full = projectCreateSchema.parse({ name: "Peça", filamentType: "", infill: "", description: "" });
    const parsed = projectUpdateSchema.parse(full);
    const row = projectPatchToRow(parsed);
    expect(row).toMatchObject({
      name: "Peça", filament_type: null, infill: null, description: null,
      layer_height: 0.2, kwh_price: 0.85,
    });
    expect(Object.keys(row)).toHaveLength(14);
  });
});

describe("supplierUpdateSchema", () => {
  it("does not touch notes/rating when they are not sent", () => {
    const r = supplierUpdateSchema.parse({ name: "eSun", phone: "11988887777" });
    expect(supplierPatchToRow(r)).toEqual({ name: "eSun", phone: "11988887777" });
  });

  it("keeps avgDeliveryDays = 0 and clears blank optional text", () => {
    const r = supplierUpdateSchema.parse({ avgDeliveryDays: 0, website: "" });
    expect(supplierPatchToRow(r)).toEqual({ avg_delivery_days: 0, website: null });
  });

  it("validates rating range and category", () => {
    expect(supplierUpdateSchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(supplierUpdateSchema.safeParse({ category: "nope" }).success).toBe(false);
    expect(supplierUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("calendar event schemas", () => {
  const base = { title: "Revisão", date: "2026-10-06", type: "maintenance", printerName: "Ender #01", contactName: "Ana" };

  it("update is a full replace (title, date and type are required)", () => {
    expect(calendarEventUpdateSchema.safeParse({ title: "x" }).success).toBe(false);
    expect(calendarEventUpdateSchema.safeParse(base).success).toBe(true);
  });

  it("rejects malformed dates", () => {
    expect(calendarEventCreateSchema.safeParse({ ...base, date: "06/10/2026" }).success).toBe(false);
  });

  it("keeps only the field that matches the type", () => {
    const maintenance = calendarEventToRow(calendarEventUpdateSchema.parse(base));
    expect(maintenance).toMatchObject({ printer_name: "Ender #01", contact_name: null, event_date: "2026-10-06" });

    const meeting = calendarEventToRow(calendarEventUpdateSchema.parse({ ...base, type: "meeting" }));
    expect(meeting).toMatchObject({ printer_name: null, contact_name: "Ana" });

    const custom = calendarEventToRow(calendarEventUpdateSchema.parse({ ...base, type: "custom", description: "" }));
    expect(custom).toMatchObject({ printer_name: null, contact_name: null, description: null });
  });
});
