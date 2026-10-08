# DeskcommCRM — Suprimentos, Insumos & Compras Automáticas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated inventory deduction on Service Order completion, automatic financial expense logging on supplier purchases, a quotation generator for low-stock items via WhatsApp/PDF, and an asset depreciation ledger.

**Architecture:** Database schema migration for purchase-financial links, Next.js Server Actions for automatic cross-module transactions (Suppliers ➔ Control, OS ➔ Inventory), and React client components for quotation generation and asset depreciation.

**Tech Stack:** Next.js 15 (App Router), Supabase PostgreSQL + RLS, TypeScript, React 18, Vitest.

**Spec:** [docs/superpowers/specs/2026-10-07-crm-supplies-procurement-design.md](file:///c:/Users/Gui/Documents/GUILHERME/Claude/PROJETOS/gltech3d/docs/superpowers/specs/2026-10-07-crm-supplies-procurement-design.md)

## Global Constraints

- **Multi-tenancy**: Every table query and action MUST filter by `organization_id` using `resolveActiveOrg(authUser)`.
- **PRO Access**: Every mutation MUST assert PRO plan access via `assertProAccess(activeOrg.orgId)`.
- **Snake Case**: File naming uses snake_case or kebab-case per `DeskcommCRM` guidelines.
- **Tests**: Every task must include unit/integration tests that pass before committing.

## Review Focus

1. **Multi-tenant Data Leakage**: Cross-module inserts (e.g. creating a financial record from a supplier purchase) MUST use the caller's active `organization_id`.
2. **Negative Stock Guard**: Stock deduction upon OS completion MUST clamp at zero (`GREATEST(0, weight_grams - consumed)`) to prevent negative inventory.
3. **Double Expense Creation**: Re-submitting a purchase must not duplicate financial expense records.
4. **Depreciation Division by Zero**: Useful life in months must default to >= 1 to prevent division by zero in linear depreciation calculations.
5. **WhatsApp Message Encoding**: WhatsApp message text must use `encodeURIComponent` for special characters and emojis.

---

### Task 1: Database Migration for Supplies & Procurement Link

**Files:**
- Create: `supabase/migrations/20261007160000_0088_supplies_and_procurement.sql`
- Test: `tests/unit/supplies-migration-drift.test.ts`

**Interfaces:**
- Produces: `supplier_purchases.financial_record_id` foreign key column.

- [ ] **Step 1: Write migration SQL file**

Create `supabase/migrations/20261007160000_0088_supplies_and_procurement.sql` adding `financial_record_id` column to `supplier_purchases`.

- [ ] **Step 2: Write test for schema migration drift**

Create `tests/unit/supplies-migration-drift.test.ts` asserting SQL syntax and column definitions.

- [ ] **Step 3: Run Vitest to verify tests pass**

Run: `npx vitest run tests/unit/supplies-migration-drift.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261007160000_0088_supplies_and_procurement.sql tests/unit/supplies-migration-drift.test.ts
git commit -m "feat(db): add financial_record_id column to supplier_purchases table"
```

---

### Task 2: Automatic Financial Expense Logging on Supplier Purchase

**Files:**
- Modify: `app/actions/suppliers/actions.ts`
- Test: `tests/unit/suppliers-financial-integration.test.ts`

**Interfaces:**
- Consumes: `createPurchase(raw: unknown)`
- Produces: Automatic `financial_records` expense insertion linked to `supplier_purchases`.

- [ ] **Step 1: Write unit tests for purchase financial integration**

Create `tests/unit/suppliers-financial-integration.test.ts` testing `createPurchase` to verify it inserts into both `supplier_purchases` and `financial_records`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/suppliers-financial-integration.test.ts`
Expected: FAIL (cross-module insert not implemented)

- [ ] **Step 3: Implement automatic financial expense creation in `app/actions/suppliers/actions.ts`**

Update `createPurchase` to insert a corresponding expense record into `financial_records` with category `'Insumo'` or `'Ferramentas'`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/suppliers-financial-integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/actions/suppliers/actions.ts tests/unit/suppliers-financial-integration.test.ts
git commit -m "feat(suppliers): automatically log financial expense when registering supplier purchase"
```

---

### Task 3: Automatic Stock Deduction on Service Order Completion

**Files:**
- Modify: `app/actions/service-orders/actions.ts`
- Test: `tests/unit/service-orders-stock-deduction.test.ts`

**Interfaces:**
- Consumes: `updateServiceOrderStatus(id: string, status: string)`
- Produces: Stock deduction in `filaments` / `consumables` upon marking an OS as `'concluido'`.

- [ ] **Step 1: Write unit tests for OS stock deduction**

Create `tests/unit/service-orders-stock-deduction.test.ts` testing `updateServiceOrderStatus` when transitioning to `'concluido'`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/service-orders-stock-deduction.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement stock deduction logic in `app/actions/service-orders/actions.ts`**

Update `updateServiceOrderStatus` to deduct total OS filament weight from `filaments` table clamped at 0.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/service-orders-stock-deduction.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/actions/service-orders/actions.ts tests/unit/service-orders-stock-deduction.test.ts
git commit -m "feat(service-orders): deduct filament stock automatically when service order is completed"
```

---

### Task 4: Quotation Generator Modal for Suppliers

**Files:**
- Create: `app/app/(pro)/suppliers/_components/QuotationGeneratorModal.tsx`
- Modify: `app/app/(pro)/suppliers/_components/SuppliersClient.tsx`
- Test: `app/app/(pro)/suppliers/_components/QuotationGeneratorModal.test.tsx`

**Interfaces:**
- Consumes: `filaments` low stock list, `suppliers` list.
- Produces: Formatted WhatsApp message link and quotation requisition generator.

- [ ] **Step 1: Write unit test for quotation generator message formatting**

Create `app/app/(pro)/suppliers/_components/QuotationGeneratorModal.test.tsx` verifying WhatsApp URL encoding and item list formatting.

- [ ] **Step 2: Implement `QuotationGeneratorModal.tsx`**

Build modal allowing selection of low-stock items, target supplier, and generating direct WhatsApp message link.

- [ ] **Step 3: Integrate modal into `SuppliersClient.tsx`**

Add "Gerar Cotação de Compras" button in Suppliers toolbar.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run app/app/(pro)/suppliers/_components/QuotationGeneratorModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/app/(pro)/suppliers/_components/QuotationGeneratorModal.tsx app/app/(pro)/suppliers/_components/SuppliersClient.tsx app/app/(pro)/suppliers/_components/QuotationGeneratorModal.test.tsx
git commit -m "feat(suppliers-ui): add quotation generator modal with WhatsApp direct link for low stock items"
```

---

### Task 5: Asset Depreciation & Maintenance Ledger in Inventory UI

**Files:**
- Modify: `app/app/(pro)/inventory/_components/InventoryClient.tsx`
- Test: `app/app/(pro)/inventory/_components/InventoryClient.test.tsx`

**Interfaces:**
- Consumes: `InventoryAssetView` with linear depreciation calculation.
- Produces: Asset depreciation summary card and maintenance status ledger on Inventory page.

- [ ] **Step 1: Write unit test for InventoryClient depreciation UI logic**

Create `app/app/(pro)/inventory/_components/InventoryClient.test.tsx` verifying asset valuation calculations and status filters.

- [ ] **Step 2: Update `InventoryClient.tsx`**

Add Depreciation Card, Useful Life ProgressBar, and Maintenance Status Badge to Inventory UI.

- [ ] **Step 3: Run full Vitest test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add app/app/(pro)/inventory/_components/InventoryClient.tsx app/app/(pro)/inventory/_components/InventoryClient.test.tsx
git commit -m "feat(inventory-ui): add asset depreciation breakdown and maintenance status ledger"
```
