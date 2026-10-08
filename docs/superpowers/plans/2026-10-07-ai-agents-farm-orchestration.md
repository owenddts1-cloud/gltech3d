# Sistema Autônomo de Agentes de IA & Orquestração de Impressão 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 cognitive AI agents (`PricingEngineAgent`, `FarmOrchestratorAgent`, `InventorySentinelAgent`, `CXPumpAgent`) and an Event-Driven Orchestrator route for 3D print farm automation with mass-domain spool inventory and RLS tenant isolation.

**Architecture:** Database schema migration for 3D farm machines, mass-domain spools inventory, orders & production jobs with RLS; TypeScript tool-calling agent modules; and Next.js Webhook Event Orchestrator route.

**Tech Stack:** Next.js 15 (App Router), Supabase PostgreSQL + RLS, TypeScript, Vitest, Zod.

**Spec:** [docs/superpowers/specs/2026-10-07-ai-agents-farm-orchestration-design.md](file:///c:/Users/Gui/Documents/GUILHERME/Claude/PROJETOS/gltech3d/docs/superpowers/specs/2026-10-07-ai-agents-farm-orchestration-design.md)

## Global Constraints

- **Multi-tenancy**: Every query and agent action MUST filter by `tenant_id` / `organization_id`.
- **PRO Access**: Every mutation MUST assert PRO plan access via `assertProAccess`.
- **Mass Domain**: Spool inventory and material calculations operate strictly in grams ($g$) and $R\$/kg$. No volume or density conversions.
- **Tests**: Every task must include unit tests that pass in Vitest before committing.

## Review Focus

1. **Mass Domain Calculations**: Ensure purge mass ($M_{purge} \cdot N_{switches}$) and waste factor ($\alpha_{waste}$) are accurately summed in grams.
2. **Negative Mass Constraint**: Spool reservation/deduction MUST fail or clamp cleanly without violating `remaining_weight_g >= 0`.
3. **Machine Match Criteria**: Filter machines by polymer compatibility (ABS requires enclosure), nozzle diameter, multi-material support, and build volume.
4. **Tenant Data Leakage**: Cross-module jobs and agent actions MUST strictly isolate data by `tenant_id`.

---

### Task 1: Database Migration for AI Agents & Farm System (`0089`)

**Files:**
- Create: `supabase/migrations/20261009000000_0089_ai_agents_farm_system.sql`
- Test: `tests/unit/ai-farm-migration-drift.test.ts`

**Interfaces:**
- Produces: Tables `machines`, `spools_inventory`, `orders`, `order_items`, `production_jobs` with RLS policies.

- [ ] **Step 1: Write migration SQL file**
Create `supabase/migrations/20261009000000_0089_ai_agents_farm_system.sql`.

- [ ] **Step 2: Write test for schema migration drift**
Create `tests/unit/ai-farm-migration-drift.test.ts`.

- [ ] **Step 3: Run Vitest to verify tests pass**
Run: `npx vitest run tests/unit/ai-farm-migration-drift.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20261009000000_0089_ai_agents_farm_system.sql tests/unit/ai-farm-migration-drift.test.ts
git commit -m "feat(db): add schema migration 0089 for 3d print farm machines, spools and production jobs"
```

---

### Task 2: PricingEngineAgent Tool Calling Module

**Files:**
- Create: `lib/ai/agents/pricing.ts`
- Test: `lib/ai/agents/pricing.test.ts`

**Interfaces:**
- Produces: `calculateMaterialConsumption`, `computeMachineOperatingCost`, `estimateBenchLaborCost`, `executePricingEngine`.

- [ ] **Step 1: Write unit tests for pricing agent tools**
Create `lib/ai/agents/pricing.test.ts`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run lib/ai/agents/pricing.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/ai/agents/pricing.ts`**
Implement material consumption, machine operating cost, bench labor, and risk coefficient calculations.

- [ ] **Step 4: Run test to verify pass**
Run: `npx vitest run lib/ai/agents/pricing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/ai/agents/pricing.ts lib/ai/agents/pricing.test.ts
git commit -m "feat(ai-agents): add PricingEngineAgent tool calling implementation"
```

---

### Task 3: FarmOrchestratorAgent Tool Calling Module

**Files:**
- Create: `lib/ai/agents/orchestrator.ts`
- Test: `lib/ai/agents/orchestrator.test.ts`

**Interfaces:**
- Produces: `matchOptimalMachine`, `dispatchProductionJob`.

- [ ] **Step 1: Write unit tests for orchestrator tools**
Create `lib/ai/agents/orchestrator.test.ts`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run lib/ai/agents/orchestrator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/ai/agents/orchestrator.ts`**
Implement machine compatibility matching (nozzle, enclosure, multi-material, build volume) and OS job dispatching.

- [ ] **Step 4: Run test to verify pass**
Run: `npx vitest run lib/ai/agents/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/ai/agents/orchestrator.ts lib/ai/agents/orchestrator.test.ts
git commit -m "feat(ai-agents): add FarmOrchestratorAgent tool calling implementation"
```

---

### Task 4: InventorySentinelAgent Tool Calling Module

**Files:**
- Create: `lib/ai/agents/inventory.ts`
- Test: `lib/ai/agents/inventory.test.ts`

**Interfaces:**
- Produces: `reserveAndDeductSpoolMass`, `evaluateInventoryRunoutRisk`.

- [ ] **Step 1: Write unit tests for inventory sentinel tools**
Create `lib/ai/agents/inventory.test.ts`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run lib/ai/agents/inventory.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/ai/agents/inventory.ts`**
Implement atomic spool mass reservation/deduction and low stock (<50g) alert evaluation.

- [ ] **Step 4: Run test to verify pass**
Run: `npx vitest run lib/ai/agents/inventory.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/ai/agents/inventory.ts lib/ai/agents/inventory.test.ts
git commit -m "feat(ai-agents): add InventorySentinelAgent tool calling implementation"
```

---

### Task 5: CXPumpAgent & Event Orchestrator Route

**Files:**
- Create: `lib/ai/agents/cx.ts`
- Create: `app/api/v1/webhooks/ai-orchestrator/route.ts`
- Test: `app/api/v1/webhooks/ai-orchestrator/route.test.ts`

**Interfaces:**
- Produces: `generateTechnicalProposal`, `dispatchCustomerUpdate`, POST `/api/v1/webhooks/ai-orchestrator`.

- [ ] **Step 1: Write unit tests for CX pump agent and orchestrator webhook route**
Create `app/api/v1/webhooks/ai-orchestrator/route.test.ts`.

- [ ] **Step 2: Run test to verify failure**
Run: `npx vitest run app/api/v1/webhooks/ai-orchestrator/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement CX agent in `lib/ai/agents/cx.ts` and webhook route in `app/api/v1/webhooks/ai-orchestrator/route.ts`**
Implement proposal generation, customer notifications, and multi-agent pipeline routing.

- [ ] **Step 4: Run test to verify pass**
Run: `npx vitest run app/api/v1/webhooks/ai-orchestrator/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/ai/agents/cx.ts app/api/v1/webhooks/ai-orchestrator/route.ts app/api/v1/webhooks/ai-orchestrator/route.test.ts
git commit -m "feat(ai-orchestrator): add CXPumpAgent and multi-agent event orchestrator webhook API route"
```
