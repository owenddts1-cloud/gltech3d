import { describe, it, expect, vi, beforeEach } from "vitest";

const insertedRows: Array<Record<string, any>> = [];
const setCookieCalls: Array<Record<string, any>> = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: async (row: any) => {
        insertedRows.push(row);
        return { error: null };
      },
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: vi.fn(),
    set: (name: string, value: string, options: any) => {
      setCookieCalls.push({ name, value, options });
    },
  }),
}));

import {
  registerTrustedDevice,
  TRUSTED_DEVICE_MAX_AGE_DAYS,
  TRUSTED_DEVICE_EXTENDED_MAX_AGE_DAYS,
} from "@/lib/auth/trusted-device";

describe("trusted device TTL and expiration policy", () => {
  beforeEach(() => {
    insertedRows.length = 0;
    setCookieCalls.length = 0;
  });

  it("exports standard (30d) and extended (365d) constants", () => {
    expect(TRUSTED_DEVICE_MAX_AGE_DAYS).toBe(30);
    expect(TRUSTED_DEVICE_EXTENDED_MAX_AGE_DAYS).toBe(365);
  });

  it("defaults to 30 days TTL when extendedTtl is omitted or false", async () => {
    const before = Date.now();
    await registerTrustedDevice("user-1", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "127.0.0.1");
    const after = Date.now();

    expect(insertedRows.length).toBe(1);
    const row = insertedRows[0]!;
    const expiryMs = new Date(row.expires_at).getTime();

    const expectedMin = before + 30 * 24 * 60 * 60 * 1000;
    const expectedMax = after + 30 * 24 * 60 * 60 * 1000;
    expect(expiryMs).toBeGreaterThanOrEqual(expectedMin);
    expect(expiryMs).toBeLessThanOrEqual(expectedMax);

    expect(setCookieCalls.length).toBe(1);
    expect(setCookieCalls[0]!.options.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("uses 365 days TTL when extendedTtl: true is specified for directorate", async () => {
    const before = Date.now();
    await registerTrustedDevice("user-director-1", "Mozilla/5.0 (Macintosh)", "10.0.0.1", {
      extendedTtl: true,
    });
    const after = Date.now();

    expect(insertedRows.length).toBe(1);
    const row = insertedRows[0]!;
    const expiryMs = new Date(row.expires_at).getTime();

    const expectedMin = before + 365 * 24 * 60 * 60 * 1000;
    const expectedMax = after + 365 * 24 * 60 * 60 * 1000;
    expect(expiryMs).toBeGreaterThanOrEqual(expectedMin);
    expect(expiryMs).toBeLessThanOrEqual(expectedMax);

    expect(setCookieCalls.length).toBe(1);
    expect(setCookieCalls[0]!.options.maxAge).toBe(365 * 24 * 60 * 60);
  });
});
