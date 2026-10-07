import { describe, it, expect } from "vitest";
import { CRM_NAV } from "@/components/shell/nav-crm";
import { filterCrmNav, RESTRICTED_NON_ADMIN_HREFS } from "@/lib/auth/nav-filter";

describe("nav-crm filtering for non-admin users", () => {
  it("keeps all navigation items for admins", () => {
    const adminNav = filterCrmNav(CRM_NAV, { isAdmin: true });
    expect(adminNav.length).toBe(CRM_NAV.length);

    // Verify restricted items exist in admin nav
    const allAdminHrefs = adminNav.flatMap((e) =>
      "children" in e ? e.children.map((c) => c.href) : [e.href],
    );
    expect(allAdminHrefs).toContain("/app/pedidos-site");
    expect(allAdminHrefs).toContain("/app/connections");
    expect(allAdminHrefs).toContain("/app/lgpd/requests");
    expect(allAdminHrefs).toContain("/app/ai/agents");
    expect(allAdminHrefs).toContain("/automations");
    expect(allAdminHrefs).toContain("/content-studio");
    expect(allAdminHrefs).toContain("/app/landing-edit");
  });

  it("strictly hides restricted modules for non-admin users", () => {
    const nonAdminNav = filterCrmNav(CRM_NAV, { isAdmin: false });

    const allNonAdminHrefs = nonAdminNav.flatMap((e) =>
      "children" in e ? e.children.map((c) => c.href) : [e.href],
    );

    // None of the restricted items must be present
    for (const restrictedHref of RESTRICTED_NON_ADMIN_HREFS) {
      expect(allNonAdminHrefs).not.toContain(restrictedHref);
    }

    // Verify key allowed items still exist for non-admins
    expect(allNonAdminHrefs).toContain("/app/dashboard");
    expect(allNonAdminHrefs).toContain("/app/calculator");
    expect(allNonAdminHrefs).toContain("/app/sales");
    expect(allNonAdminHrefs).toContain("/app/products");
    expect(allNonAdminHrefs).toContain("/app/inbox");
    expect(allNonAdminHrefs).toContain("/app/settings");
  });
});
