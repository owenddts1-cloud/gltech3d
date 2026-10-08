# DeskcommCRM — Financeiro, DRE & Canais de Vendas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 100% production-ready DRE financial control, 1-click batch conciliation, CSV exports, and Sales Channel integration management (Shopee, Mercado Livre, Facebook) with live webhook simulator and order processing.

**Architecture:** Database schema migration for financial record status/fees and sales channel settings, Next.js Server Actions for conciliation and credential management, DRE computation engine, CSV exporter, webhook API handlers, and interactive React UI components.

**Tech Stack:** Next.js 15 (App Router), Supabase PostgreSQL + RLS, TypeScript, React 18, Vitest.

**Spec:** [docs/superpowers/specs/2026-10-07-crm-financial-sales-design.md](file:///c:/Users/Gui/Documents/GUILHERME/Claude/PROJETOS/gltech3d/docs/superpowers/specs/2026-10-07-crm-financial-sales-design.md)

## Global Constraints

- **Multi-tenancy**: Every table query and action MUST filter by `organization_id` using `resolveActiveOrg(authUser)`.
- **Formatting**: Currency must be stored as cents (`BIGINT`/`INTEGER`) in DB and formatted using `lib/format/money.ts`.
- **Snake Case**: Internal ts files use snake_case or kebab-case per project conventions (`DeskcommCRM`).
- **Tests**: Every task must include unit/integration tests that pass before committing.

## Review Focus

1. **Unauthenticated access to Webhooks or Actions**: Public webhook endpoints must validate secret tokens or platform signatures.
2. **Multi-tenant Data Leakage**: Sales channel credentials and financial records must be isolated by `organization_id`.
3. **Rounding Errors in DRE**: Net amounts must compute `revenue_cents - platform_fee_cents` precisely without floating-point drift.
4. **Offline / Unconfigured Channels**: UI must gracefully display connection health and allow testing via simulator when real API keys are missing.
5. **CSV Export Encoding**: CSV export must include UTF-8 BOM (`\uFEFF`) for proper display in Excel/Numbers.

---

### Task 1: Database Migration for Financial Records & Sales Channel Integrations

**Files:**
- Create: `supabase/migrations/20261007150000_0087_financial_and_sales_channels.sql`
- Test: `tests/unit/financial-and-channels-migration-drift.test.ts`

**Interfaces:**
- Produces: `financial_records.status`, `financial_records.net_cents`, `financial_records.platform_fee_cents`, `financial_records.reconciled_at` columns, and `sales_channel_integrations` table.

- [ ] **Step 1: Write migration SQL file**

Create `supabase/migrations/20261007150000_0087_financial_and_sales_channels.sql` with schema additions for `status`, `net_cents`, `platform_fee_cents`, `reconciled_at` on `financial_records`, and table `sales_channel_integrations` with RLS policies.

- [ ] **Step 2: Write test for schema migration drift**

Create `tests/unit/financial-and-channels-migration-drift.test.ts` to assert that SQL migration statements parse without syntax errors and contain correct columns and RLS constraints.

- [ ] **Step 3: Run Vitest to verify tests pass**

Run: `npx vitest run tests/unit/financial-and-channels-migration-drift.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261007150000_0087_financial_and_sales_channels.sql tests/unit/financial-and-channels-migration-drift.test.ts
git commit -m "feat(db): add financial status columns and sales_channel_integrations table migration"
```

---

### Task 2: Financial Control Server Actions & DRE Engine

**Files:**
- Modify: `app/actions/control/actions.ts`
- Create: `app/app/(pro)/control/_lib/dre.ts`
- Test: `app/app/(pro)/control/_lib/dre.test.ts`
- Test: `tests/unit/financial-control-actions.test.ts`

**Interfaces:**
- Consumes: `financial_records` table
- Produces:
  - `reconcileFinancialRecords(ids: string[]): Promise<{ ok: boolean; count?: number; error?: string }>`
  - `calculateDRE(records: FinancialRecord[]): DRESummary`

- [ ] **Step 1: Write unit tests for DRE computation and conciliation actions**

Create `app/app/(pro)/control/_lib/dre.test.ts` testing gross revenue, platform fee deductions, net revenue, CPV, and net profit calculations.
Create `tests/unit/financial-control-actions.test.ts` testing Server Action `reconcileFinancialRecords`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run app/app/(pro)/control/_lib/dre.test.ts`
Expected: FAIL (files missing)

- [ ] **Step 3: Implement `dre.ts` and update `actions.ts`**

Implement `calculateDRE` in `app/app/(pro)/control/_lib/dre.ts` and add `reconcileFinancialRecords` to `app/actions/control/actions.ts`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run app/app/(pro)/control/_lib/dre.test.ts tests/unit/financial-control-actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/actions/control/actions.ts app/app/(pro)/control/_lib/dre.ts app/app/(pro)/control/_lib/dre.test.ts tests/unit/financial-control-actions.test.ts
git commit -m "feat(control): add DRE calculation engine and batch conciliation Server Action"
```

---

### Task 3: Interactive Financial Control UI (Batch Conciliation, DRE View & CSV Export)

**Files:**
- Create: `app/app/(pro)/control/_lib/csv-export.ts`
- Modify: `app/app/(pro)/control/_components/ControlClient.tsx`
- Test: `app/app/(pro)/control/_lib/csv-export.test.ts`
- Test: `app/app/(pro)/control/_components/ControlClient.test.tsx`

**Interfaces:**
- Consumes: `reconcileFinancialRecords`, `calculateDRE`
- Produces: Interactive DRE view mode, row checkboxes, "Conciliar Selecionados" button, CSV Exporter.

- [ ] **Step 1: Write test for CSV exporter**

Create `app/app/(pro)/control/_lib/csv-export.test.ts` ensuring UTF-8 BOM, escaped comma values, and correct headers.

- [ ] **Step 2: Implement `csv-export.ts`**

Implement `exportFinancialRecordsToCSV(records: FinancialRecord[])` in `app/app/(pro)/control/_lib/csv-export.ts`.

- [ ] **Step 3: Update `ControlClient.tsx` UI**

Add DRE view mode toggle switch, multi-select checkboxes on rows, "Conciliar Selecionados" header button with loading state, and "Exportar CSV" button.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run app/app/(pro)/control/_lib/csv-export.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/app/(pro)/control/_lib/csv-export.ts app/app/(pro)/control/_components/ControlClient.tsx app/app/(pro)/control/_lib/csv-export.test.ts
git commit -m "feat(control-ui): add batch conciliation button, DRE toggle view, and CSV export"
```

---

### Task 4: Sales Channel Integrations Server Actions & Webhook Handler

**Files:**
- Create: `app/actions/sales/channels.ts`
- Create: `app/api/v1/webhooks/sales-channel/route.ts`
- Test: `tests/unit/sales-channels.test.ts`

**Interfaces:**
- Produces:
  - `fetchChannelIntegration(platform: string)`
  - `saveChannelCredentials(platform: string, credentials: Record<string, string>)`
  - `simulateTestSale(platform: string)`
  - `POST /api/v1/webhooks/sales-channel`

- [ ] **Step 1: Write unit tests for channel integration actions and simulator**

Create `tests/unit/sales-channels.test.ts` testing credential saving, integration fetching, test sale simulation (creating sale, updating inventory, generating financial record), and webhook POST handling.

- [ ] **Step 2: Implement `app/actions/sales/channels.ts`**

Implement Server Actions for reading/saving channel credentials and the `simulateTestSale` workflow.

- [ ] **Step 3: Implement Webhook API Route**

Implement `app/api/v1/webhooks/sales-channel/route.ts` to handle incoming webhook POST payloads.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/sales-channels.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/actions/sales/channels.ts app/api/v1/webhooks/sales-channel/route.ts tests/unit/sales-channels.test.ts
git commit -m "feat(sales-channels): add channel integrations server actions, test simulator, and webhook route"
```

---

### Task 5: Sales Channel UI Views for Shopee, Mercado Livre & Facebook

**Files:**
- Create: `app/app/(pro)/sales/_components/SalesChannelView.tsx`
- Modify: `app/app/(pro)/sales/shopee/page.tsx`
- Modify: `app/app/(pro)/sales/mercado-livre/page.tsx`
- Modify: `app/app/(pro)/sales/facebook/page.tsx`
- Test: `app/app/(pro)/sales/_components/SalesChannelView.test.tsx`

**Interfaces:**
- Consumes: `fetchChannelIntegration`, `saveChannelCredentials`, `simulateTestSale`
- Produces: Unified channel management panel with credential form, webhook secret key display, connection health status, test sale simulator button, and platform sales feed.

- [ ] **Step 1: Write UI tests for `SalesChannelView`**

Create `app/app/(pro)/sales/_components/SalesChannelView.test.tsx` verifying connection status badge, credential modal/form, simulator button triggering test sale, and webhook URL display.

- [ ] **Step 2: Implement `SalesChannelView.tsx`**

Build `SalesChannelView.tsx` component incorporating credential settings, connection health badge, webhook endpoint details, test simulator button, and platform-filtered sales table/kanban.

- [ ] **Step 3: Wire Shopee, Mercado Livre, and Facebook pages**

Update `app/app/(pro)/sales/shopee/page.tsx`, `mercado-livre/page.tsx`, and `facebook/page.tsx` to render `SalesChannelView`.

- [ ] **Step 4: Run Vitest suite to verify clean pass**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add app/app/(pro)/sales/_components/SalesChannelView.tsx app/app/(pro)/sales/shopee/page.tsx app/app/(pro)/sales/mercado-livre/page.tsx app/app/(pro)/sales/facebook/page.tsx app/app/(pro)/sales/_components/SalesChannelView.test.tsx
git commit -m "feat(sales-ui): add operational sales channel views for Shopee, Mercado Livre, and Facebook"
```
