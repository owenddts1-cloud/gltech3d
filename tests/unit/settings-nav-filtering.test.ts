import { describe, it, expect } from "vitest";
import { SETTINGS_LINKS, filterSettingsLinks } from "@/lib/auth/settings-filter";

describe("settings navigation filtering for non-admin users", () => {
  it("allows directorate and platform admins to see all settings tabs including system tools", () => {
    const adminLinks = filterSettingsLinks(SETTINGS_LINKS, { isDirectorOrPlatformAdmin: true });
    expect(adminLinks.length).toBe(SETTINGS_LINKS.length);

    const hrefs = adminLinks.map((l) => l.href);
    expect(hrefs).toContain("/app/settings/api-tokens");
    expect(hrefs).toContain("/app/settings/tenant/pipelines");
    expect(hrefs).toContain("/app/audit");
  });

  it("restricts other users (including PRO clients) to only the basic settings package", () => {
    const nonAdminLinks = filterSettingsLinks(SETTINGS_LINKS, { isDirectorOrPlatformAdmin: false });

    const hrefs = nonAdminLinks.map((l) => l.href);

    // Forbidden for non-director
    expect(hrefs).not.toContain("/app/settings/api-tokens");
    expect(hrefs).not.toContain("/app/settings/tenant/pipelines");
    expect(hrefs).not.toContain("/app/audit");

    // Permitted basic package
    expect(hrefs).toContain("/app/settings/profile");
    expect(hrefs).toContain("/app/settings/security");
    expect(hrefs).toContain("/app/settings/notifications");
    expect(hrefs).toContain("/app/settings/billing");
    expect(hrefs).toContain("/app/settings/tenant");
    expect(hrefs).toContain("/app/settings/tenant/whatsapp");
    expect(nonAdminLinks.length).toBe(6);
  });
});
