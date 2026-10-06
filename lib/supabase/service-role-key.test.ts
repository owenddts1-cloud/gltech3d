import { describe, expect, it } from "vitest";
import { isUsableServiceRoleKey } from "./service-role-key";

describe("isUsableServiceRoleKey", () => {
  it("accepts the new sb_secret_ format (41 chars)", () => {
    const key = "sb_secret_" + "a".repeat(31);
    expect(key).toHaveLength(41);
    expect(isUsableServiceRoleKey(key)).toBe(true);
  });

  it("accepts a legacy JWT key", () => {
    expect(isUsableServiceRoleKey("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + "x".repeat(150))).toBe(true);
  });

  it("rejects empty, whitespace and missing values", () => {
    expect(isUsableServiceRoleKey("")).toBe(false);
    expect(isUsableServiceRoleKey("   ")).toBe(false);
    expect(isUsableServiceRoleKey(undefined)).toBe(false);
    expect(isUsableServiceRoleKey(null)).toBe(false);
  });

  it("rejects placeholders from .env.example", () => {
    expect(isUsableServiceRoleKey("PLACEHOLDER_SERVICE_ROLE_KEY")).toBe(false);
    expect(isUsableServiceRoleKey("placeholder")).toBe(false);
  });
});
