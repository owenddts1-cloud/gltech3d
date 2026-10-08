# CRM Financial & Realtime DRE Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 100% production-ready Realtime DRE (Gross Revenue -> CPV/Machine Hours -> Contribution Margin -> Fixed Expenses -> Net Operating Profit), automatic site orders revenue recording, farm jobs CPV debit, Pix cashflow conciliation, and accounts payable for procurement integration.

**Architecture:** Database schema migration for financial record links, accounts payable, and financial transactions view; Server Actions for automatic revenue/CPV generation, DRE calculation engine, cashflow projections, and interactive Next.js App Router UI pages.

**Tech Stack:** Next.js 15 (App Router), Supabase PostgreSQL + RLS, TypeScript, Tailwind CSS, Vitest.

**Spec:** [docs/superpowers/specs/2026-10-07-crm-financial-realtime-dre-design.md](file:///c:/Users/Gui/Documents/GUILHERME/Claude/PROJETOS/gltech3d/docs/superpowers/specs/2026-10-07-crm-financial-realtime-dre-design.md)

## Global Constraints

- **Multi-tenancy**: Every query and server action MUST filter by `organization_id` via `resolveActiveOrg`.
- **PRO Access**: Every mutation MUST assert PRO plan access via `assertProAccess`.
- **Currency Domain**: Calculations and database fields operate strictly in cents (`BIGINT`/`INTEGER`) to avoid floating-point drift.
- **Tests**: Every task must include unit tests passing in Vitest before committing.

## Review Focus

1. **Floating-point drift**: Always calculate financial amounts in integer cents, converting to R$ only for display.
2. **Channel-based DRE**: Filter accurately between `site_filaments`, `demand_printing`, and general channels.
3. **Double counting CPV**: Ensure jobs completed do not debit filament mass cost twice.
4. **Tenant data isolation**: Ensure accounts payable and transactions strictly verify `organization_id`.
5. **Idempotent conciliation**: Pix conciliation must mark records as reconciled and update timestamps safely.

---

### Task 1: Database Migration 0091 (Financial Links, Transactions View & Accounts Payable)

**Files:**
- Create: `supabase/migrations/20261011000000_0091_financial_transactions_cashflow_dre.sql`
- Test: `tests/unit/financial-dre-migration-drift.test.ts`

**Interfaces:**
- Produces: `financial_records` columns (`order_id`, `production_job_id`, `channel`, `payment_method`, `pix_e2e_id`, `cpv_filament_cost_cents`, `cpv_machine_cost_cents`, `is_projected`, `due_date`), table `accounts_payable`, and view `financial_transactions`.

- [ ] **Step 1: Write migration SQL file**
Create `supabase/migrations/20261011000000_0091_financial_transactions_cashflow_dre.sql`.

- [ ] **Step 2: Write test for schema migration drift**
Create `tests/unit/financial-dre-migration-drift.test.ts`.

- [ ] **Step 3: Run Vitest to verify tests pass**
Run: `npx vitest run tests/unit/financial-dre-migration-drift.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20261011000000_0091_financial_transactions_cashflow_dre.sql tests/unit/financial-dre-migration-drift.test.ts
git commit -m "feat(db): add migration 0091 for financial transactions, dre and accounts payable"
```

---

### Task 2: Realtime DRE Engine Module (`lib/financial/dre-engine.ts`)

**Files:**
- Create: `lib/financial/dre-engine.ts`
- Test: `lib/financial/dre-engine.test.ts`

**Interfaces:**
- Produces: `calculateRealtimeDRE(transactions, filterOptions): DREStatementResult`.

- [ ] **Step 1: Write unit tests for DRE computation**
Create `lib/financial/dre-engine.test.ts`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run lib/financial/dre-engine.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/financial/dre-engine.ts`**
Implement cascading calculation: Gross Revenue -> Platform Fees -> Net Revenue -> Direct Production Costs (Filament + Machine Hours) -> Contribution Margin -> Fixed/Operating Expenses -> Net Operating Profit.

- [ ] **Step 4: Run test to verify pass**
Run: `npx vitest run lib/financial/dre-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/financial/dre-engine.ts lib/financial/dre-engine.test.ts
git commit -m "feat(financial): implement realtime DRE calculation engine with channel and period filtering"
```

---

### Task 3: Financial Transactions Server Actions (Revenue & Farm CPV Recording)

**Files:**
- Create: `app/actions/financial/transactions.ts`
- Test: `tests/unit/financial-transactions-actions.test.ts`

**Interfaces:**
- Produces: `recordOrderRevenueAction`, `recordFarmJobCostAction`, `createManualExpenseAction`.

- [ ] **Step 1: Write unit tests for transactions server actions**
Create `tests/unit/financial-transactions-actions.test.ts`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/unit/financial-transactions-actions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `app/actions/financial/transactions.ts`**
Implement automatic revenue recording for paid orders and CPV recording for completed 3D print farm jobs.

- [ ] **Step 4: Run test to verify pass**
Run: `npx vitest run tests/unit/financial-transactions-actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add app/actions/financial/transactions.ts tests/unit/financial-transactions-actions.test.ts
git commit -m "feat(financial): add Server Actions for automatic site orders revenue and farm cpv debit"
```

---

### Task 4: Cashflow Projection & Pix Conciliation Server Actions

**Files:**
- Create: `app/actions/financial/cashflow.ts`
- Test: `tests/unit/financial-cashflow-actions.test.ts`

**Interfaces:**
- Produces: `fetchCashflowSummaryAction`, `reconcilePixTransactionAction`.

- [ ] **Step 1: Write unit tests for cashflow projection and Pix conciliation**
Create `tests/unit/financial-cashflow-actions.test.ts`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/unit/financial-cashflow-actions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `app/actions/financial/cashflow.ts`**
Implement cashflow aggregations, forecast projections, and Pix reconciliation.

- [ ] **Step 4: Run test to verify pass**
Run: `npx vitest run tests/unit/financial-cashflow-actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add app/actions/financial/cashflow.ts tests/unit/financial-cashflow-actions.test.ts
git commit -m "feat(financial): add cashflow projection and Pix conciliation Server Actions"
```

---

### Task 5: Accounts Payable (Contas a Pagar) Server Actions

**Files:**
- Create: `app/actions/financial/payable.ts`
- Test: `tests/unit/accounts-payable-actions.test.ts`

**Interfaces:**
- Produces: `fetchAccountsPayableAction`, `createAccountPayableAction`, `markPayableAsPaidAction`.

- [ ] **Step 1: Write unit tests for accounts payable**
Create `tests/unit/accounts-payable-actions.test.ts`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/unit/accounts-payable-actions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `app/actions/financial/payable.ts`**
Implement accounts payable listing, creation, and payment marking.

- [ ] **Step 4: Run test to verify pass**
Run: `npx vitest run tests/unit/accounts-payable-actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add app/actions/financial/payable.ts tests/unit/accounts-payable-actions.test.ts
git commit -m "feat(financial): add accounts payable server actions for procurement preparation"
```

---

### Task 6: Interactive UI Pages (`/app/financeiro/dre` & `/app/financeiro/fluxo-caixa`)

**Files:**
- Create: `app/app/(pro)/financeiro/dre/page.tsx`
- Create: `app/app/(pro)/financeiro/dre/DreClient.tsx`
- Create: `app/app/(pro)/financeiro/fluxo-caixa/page.tsx`
- Create: `app/app/(pro)/financeiro/fluxo-caixa/CashflowClient.tsx`
- Modify: `components/shell/nav-crm.ts`
- Test: `tests/unit/financial-dre-ui.test.tsx`

**Interfaces:**
- Produces: Realtime DRE page with period/channel filters, KPI cards, and cashflow Pix conciliation UI.

- [ ] **Step 1: Write UI tests**
Create `tests/unit/financial-dre-ui.test.tsx`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run tests/unit/financial-dre-ui.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement UI components and update navigation**
Build `DreClient.tsx`, `CashflowClient.tsx`, and add routes to `nav-crm.ts`.

- [ ] **Step 4: Run test to verify pass**
Run: `npx vitest run tests/unit/financial-dre-ui.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add app/app/\(pro\)/financeiro/ components/shell/nav-crm.ts tests/unit/financial-dre-ui.test.tsx
git commit -m "feat(financial-ui): create realtime DRE and cashflow conciliation interactive pages"
```

---

### Task 7: Final Verification & Type Safety

- [ ] **Step 1: Run complete test suite**
Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run TypeScript compiler check**
Run: `npx tsc --noEmit`
Expected: ZERO errors
