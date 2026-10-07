# RBAC, MFA & CMS Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement strict 3-tier RBAC, full CMS isolation from non-admin clients/subscribers, MFA enforcement for the board, 1-year trusted devices for directors, streamlined settings, and WebAuthn/biometrics scaffolding.

**Architecture:** Route-level and Server Action guards verifying admin status of `LANDING_ORG_SLUG` before any CMS mutations; navigation tree filtering in `components/shell/nav-crm.ts` hiding unauthorized modules from non-admins; extended TTL (365 days) in `lib/auth/trusted-device.ts` for directors; differentiated MFA in `signInWithPassword.ts`; and Supabase RLS policies in migration `0090`.

**Tech Stack:** Next.js 15 (App Router), Supabase Auth & PostgreSQL RLS, TypeScript, Vitest, Tailwind CSS, Lucide / Phosphor Icons.

**Spec:** [docs/superpowers/specs/2026-10-07-rbac-mfa-security-hardened-design.md](file:///c:/Users/Gui/Documents/GUILHERME/Claude/PROJETOS/gltech3d/docs/superpowers/specs/2026-10-07-rbac-mfa-security-hardened-design.md)

## Global Constraints

- **Landing CMS Exclusivity**: Mutating landing settings, products order or showcase filaments MUST require `is_platform_admin` OR `(activeOrg.slug === LANDING_ORG_SLUG && activeOrg.role === 'admin')`.
- **403 Fail-Closed**: Any unauthorized mutation attempt returns `{ ok: false, error: "403 Forbidden" }` with no state modification.
- **Menu Pruning**: Non-admin users MUST NOT see `pedidos-site`, `connections`, `lgpd`, `ai/agents`, `automations`, `content-studio`, or `landing-edit`.
- **Settings Pruning**: Non-admin settings are limited to `profile`, `security`, `notifications`, `billing`, `organization`, and `whatsapp`.
- **MFA Enforcement**: Directorate accounts require MFA AAL2 unless a valid trusted device cookie exists. Common users are never forced to use MFA.
- **Trusted Device**: Directorate allows 365-day TTL; regular users receive 30-day TTL.

## Review Focus

1. **Non-Admin Tampering**: Verify that a user with an active PRO plan belonging to an organization other than `gltech3d` receives 403 when calling any landing Server Action.
2. **Menu Leakage**: Verify that rendering the CRM sidebar for a non-admin role completely strips the restricted routes from the DOM.
3. **MFA Bypass Protection**: Verify that forged or expired trusted device cookies force an immediate TOTP challenge for admin accounts.
4. **Director Extended TTL**: Verify that the 365-day cookie option is only accepted if the authenticated user matches directorate criteria.
5. **Settings Route Traversal**: Verify that navigating directly to restricted settings URLs redirects non-admins safely to `/app/settings/profile`.

---

### Task 1: Landing Page & CMS Server-Side Isolation Guard

**Files:**
- Create: `lib/auth/landing-admin.ts`
- Modify: `app/actions/landing/actions.ts`
- Modify: `app/actions/filament-catalog/actions.ts`
- Modify: `app/app/(pro)/landing-edit/page.tsx`
- Test: `tests/unit/landing-admin-guard.test.ts`

**Interfaces:**
- Produces: `isLandingAdmin(user: AuthUser, activeOrg: ActiveOrg): boolean` and `assertLandingAdmin(user: AuthUser, activeOrg: ActiveOrg): Promise<void>`

- [ ] **Step 1: Write failing unit test for landing admin guard**
Create `tests/unit/landing-admin-guard.test.ts` testing that:
- Non-admin on `gltech3d` returns `false`.
- Admin on another org `client-abc` returns `false`.
- Admin on `gltech3d` returns `true`.
- Platform admin on any org returns `true`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit tests/unit/landing-admin-guard.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/auth/landing-admin.ts`**
Implement `isLandingAdmin` and `assertLandingAdmin`.

- [ ] **Step 4: Update `app/actions/landing/actions.ts` and `app/actions/filament-catalog/actions.ts`**
In `requireCtx()`, enforce `assertLandingAdmin`. If unauthorized, return `{ ok: false, error: "403 Forbidden: Apenas a diretoria da GLTech3D pode alterar a vitrine pública." }`.

- [ ] **Step 5: Protect `app/app/(pro)/landing-edit/page.tsx`**
Check `isLandingAdmin`. If false, render an access-denied state or redirect to `/app/dashboard`.

- [ ] **Step 6: Run test to verify it passes**
Run: `npm run test:unit tests/unit/landing-admin-guard.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**
```bash
git add lib/auth/landing-admin.ts app/actions/landing/actions.ts app/actions/filament-catalog/actions.ts "app/app/(pro)/landing-edit/page.tsx" tests/unit/landing-admin-guard.test.ts
git commit -m "feat(security): enforce strict landing CMS isolation for directorate admins only"
```

---

### Task 2: CRM Menu Filtering for Non-Admin Users

**Files:**
- Modify: `components/shell/nav-crm.ts`
- Create: `lib/auth/nav-filter.ts`
- Test: `tests/unit/nav-crm-filtering.test.ts`

**Interfaces:**
- Produces: `filterCrmNav(navEntries: NavEntry[], context: { isAdmin: boolean }): NavEntry[]`

- [ ] **Step 1: Write failing unit test for nav filtering**
Create `tests/unit/nav-crm-filtering.test.ts`:
- For `isAdmin: false`, verify that `pedidos-site`, `connections`, `lgpd`, `ai/agents`, `automations`, `content-studio`, and `landing-edit` are completely stripped from the navigation list.
- For `isAdmin: true`, verify that all entries remain available.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit tests/unit/nav-crm-filtering.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/auth/nav-filter.ts`**
Implement `filterCrmNav` implementing the filtering logic cleanly.

- [ ] **Step 4: Integrate into sidebar and mobile CRM navigation**
Update menu rendering components to pass the filtered navigation list based on the active user context.

- [ ] **Step 5: Run test to verify it passes**
Run: `npm run test:unit tests/unit/nav-crm-filtering.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add lib/auth/nav-filter.ts components/shell/nav-crm.ts tests/unit/nav-crm-filtering.test.ts
git commit -m "feat(rbac): filter CRM navigation menu strictly hiding restricted modules from non-admins"
```

---

### Task 3: Streamlined Settings for Non-Admin Users

**Files:**
- Modify: `components/settings/SettingsNav.tsx` (or settings shell)
- Create: `lib/auth/settings-filter.ts`
- Test: `tests/unit/settings-nav-filtering.test.ts`

**Interfaces:**
- Produces: `filterSettingsNav(tabs: SettingsTab[], context: { isAdmin: boolean }): SettingsTab[]`

- [ ] **Step 1: Write failing unit test for settings filtering**
Create `tests/unit/settings-nav-filtering.test.ts`:
- Non-admin tabs include ONLY: `profile`, `security`, `notifications`, `billing`, `organization`, and `whatsapp`.
- Admin tabs include all available system settings.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit tests/unit/settings-nav-filtering.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/auth/settings-filter.ts` and update settings nav**
Implement the filter and wire it into the settings layout/view.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test:unit tests/unit/settings-nav-filtering.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/auth/settings-filter.ts tests/unit/settings-nav-filtering.test.ts
git commit -m "feat(settings): prune settings navigation for non-admin users to basic package"
```

---

### Task 4: Trusted Device 1-Year Extended TTL for Directorate

**Files:**
- Modify: `lib/auth/trusted-device.ts`
- Modify: `app/actions/auth/verifyMfa.ts`
- Test: `tests/unit/trusted-device-ttl.test.ts`

**Interfaces:**
- Produces: `registerTrustedDevice(userId: string, userAgent: string | null, ip: string | null, opts?: { extendedTtl?: boolean }): Promise<string>`

- [ ] **Step 1: Write failing unit test for trusted device TTL**
Create `tests/unit/trusted-device-ttl.test.ts` verifying:
- Default TTL is 30 days.
- When `extendedTtl: true` is passed for a directorate user, TTL is 365 days.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit tests/unit/trusted-device-ttl.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `lib/auth/trusted-device.ts` and `app/actions/auth/verifyMfa.ts`**
Implement `extendedTtl` parameter and calculate expiry accordingly (`365 * 24 * 60 * 60 * 1000`).

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test:unit tests/unit/trusted-device-ttl.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/auth/trusted-device.ts app/actions/auth/verifyMfa.ts tests/unit/trusted-device-ttl.test.ts
git commit -m "feat(auth): add 365-day extended trusted device option for directorate admins"
```

---

### Task 5: Differentiated MFA Enforcement on Login

**Files:**
- Modify: `app/actions/auth/signInWithPassword.ts`
- Test: `tests/unit/mfa-policy.test.ts`

**Interfaces:**
- Produces: Gated login logic requiring MFA exclusively for admins/directorate while keeping common users login seamless.

- [ ] **Step 1: Write failing unit test for MFA login policy**
Create `tests/unit/mfa-policy.test.ts` verifying:
- Non-admin without MFA passes directly to portal.
- Admin with enrolled MFA without trusted device returns `mfa_required`.
- Admin with valid trusted device passes directly.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit tests/unit/mfa-policy.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `app/actions/auth/signInWithPassword.ts`**
Enforce MFA policy based on user privilege and trusted device status.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test:unit tests/unit/mfa-policy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add app/actions/auth/signInWithPassword.ts tests/unit/mfa-policy.test.ts
git commit -m "feat(auth): enforce mandatory MFA for directorate admins while keeping common login seamless"
```

---

### Task 6: Security Settings Tab (`/app/settings/security`) & WebAuthn Scaffolding

**Files:**
- Create: `lib/auth/webauthn-types.ts`
- Create: `app/app/settings/security/page.tsx`
- Create: `app/app/settings/security/_components/SecurityClient.tsx`
- Test: `tests/unit/security-page.test.ts`

- [ ] **Step 1: Write failing unit test for security page configuration**
Create `tests/unit/security-page.test.ts` testing options payload and device revocation helper.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit tests/unit/security-page.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Security page and client component**
Build clean UI with:
- 2FA Toggle & TOTP status badge.
- Active Trusted Devices list with "Revogar" button.
- "Adicionar Biometria / Passkey (Face ID / Windows Hello)" button.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test:unit tests/unit/security-page.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/auth/webauthn-types.ts "app/app/settings/security/page.tsx" "app/app/settings/security/_components/SecurityClient.tsx" tests/unit/security-page.test.ts
git commit -m "feat(security): create user security settings page with 2FA status, trusted devices and biometrics"
```

---

### Task 7: Database RLS Migration for CMS Isolation (`0090`)

**Files:**
- Create: `supabase/migrations/20261010000000_0090_cms_admin_isolation.sql`
- Test: `tests/unit/cms-isolation-migration-drift.test.ts`

- [ ] **Step 1: Write migration SQL file**
Create `supabase/migrations/20261010000000_0090_cms_admin_isolation.sql` adding explicit RLS policies for `landing_settings` and `platform_commissions` restricting mutation to admin of `LANDING_ORG_SLUG` or platform admin.

- [ ] **Step 2: Write test for schema migration drift**
Create `tests/unit/cms-isolation-migration-drift.test.ts`.

- [ ] **Step 3: Run Vitest to verify tests pass**
Run: `npm run test:unit tests/unit/cms-isolation-migration-drift.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20261010000000_0090_cms_admin_isolation.sql tests/unit/cms-isolation-migration-drift.test.ts
git commit -m "feat(db): add migration 0090 for strict landing CMS RLS admin isolation"
```

---

### Task 8: Full Verification & Visual Catalog Redesign Trigger

**Files:**
- Update: `.superpowers/sdd/` progress ledger
- Run: Full test suite

- [ ] **Step 1: Run complete verification suite**
Run: `npm run test:unit tests/unit/landing-admin-guard.test.ts tests/unit/nav-crm-filtering.test.ts tests/unit/settings-nav-filtering.test.ts tests/unit/trusted-device-ttl.test.ts tests/unit/mfa-policy.test.ts tests/unit/cms-isolation-migration-drift.test.ts`
Expected: All tests PASS.

- [ ] **Step 2: Run typecheck**
Run: `npm run typecheck`

- [ ] **Step 3: Prompt user for Visual Catalog Redesign execution**
Formally present verification results to the user and prompt:
*"Todas as pendências de RBAC e endurecimento de segurança foram finalizadas com sucesso. Deseja iniciar agora o Plano de Redesign Completo do Catálogo Visual?"*
