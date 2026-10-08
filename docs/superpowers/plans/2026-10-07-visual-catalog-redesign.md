# Visual Catalog Redesign (4 Agents) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the CRM "Gerar Catálogo Visual" into a luxury industrial editorial catalog tool (Anti-AI Aesthetic) with split-view live preview, dual presentation modes (Web Slider & A4 Print Sheet), engineering copy, and high-resolution A4 PDF export.

**Architecture:** Modular design system in `lib/catalog/editorial-design-system.ts`, conversion copy & WhatsApp deep-linking in `lib/catalog/b2b-copywriting.ts`, strict jsPDF engine in `lib/catalog/editorial-pdf-engine.ts`, and interactive split-view React components in `app/app/(pro)/products/catalog/_components/`.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS, Lucide / Phosphor Icons, jsPDF, Vitest.

**Spec:** [docs/superpowers/specs/2026-10-07-visual-catalog-redesign-design.md](file:///c:/Users/Gui/Documents/GUILHERME/Claude/PROJETOS/gltech3d/docs/superpowers/specs/2026-10-07-visual-catalog-redesign-design.md)

## Global Constraints

- **Anti-AI Aesthetic**: Zero generic buzzwords; use strict industrial manufacturing terms (FDM, resin 8K, layer heights, dimensional tolerance).
- **Dual Theme Support**: Warm Studio Minimalist (Light) and Technical Monolith (Dark).
- **Dual Presentation**: Web Slider (fullscreen interactive presentation) and A4 Print Sheet (1:1.414 physical page simulation).
- **Strict A4 Pagination**: 210 x 297 mm, 15mm margins, non-breaking product cards.
- **B2B Privacy**: Allow hiding prices for confidential commercial presentations (replaced with "Sob Consulta Técnica").

## Review Focus

1. **Non-Breaking Grid**: Ensure that switching layouts (2x2, Hero+3, Detail, Tech List) re-paginates without orphan cards.
2. **Offline Fallback / Missing Images**: Handle products without photos gracefully with technical wireframe or blueprint placeholder.
3. **Price Masking**: When B2B price toggle is disabled, all prices are replaced by "Sob Consulta Técnica" across both Web and PDF views.
4. **WhatsApp Deep Link Tracking**: Ensure generated message includes valid SKU, product name, page number and material.
5. **Mobile & Desktop Responsiveness**: The split-view folds smoothly into collapsible drawer on tablet/mobile screens.

---

### Task 1: Design System & Tokens Editoriais (Agente 1)

**Files:**
- Create: `lib/catalog/editorial-design-system.ts`
- Test: `tests/unit/editorial-design-system.test.ts`

**Interfaces:**
- Produces: `EDITORIAL_THEMES`, `CATALOG_LAYOUT_SPECS`, `TECHNICAL_BADGES`, `getThemeTokens(theme: "warm_studio" | "technical_monolith")`

- [ ] **Step 1: Write failing unit test for editorial tokens and layouts**
Create `tests/unit/editorial-design-system.test.ts` testing palette hex values, layout dimensions, and technical badge builders.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit tests/unit/editorial-design-system.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/catalog/editorial-design-system.ts`**
Export palettes (Warm Studio & Monolith), typography scales, layout definitions (2x2, Hero+3, Detail, Tech List), and technical tolerance stamps.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test:unit tests/unit/editorial-design-system.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/catalog/editorial-design-system.ts tests/unit/editorial-design-system.test.ts
git commit -m "feat(catalog): add editorial design system tokens and layout specs"
```

---

### Task 2: B2B Copywriting & Engenharia de Conversão (Agente 3)

**Files:**
- Create: `lib/catalog/b2b-copywriting.ts`
- Test: `tests/unit/b2b-copywriting.test.ts`

**Interfaces:**
- Produces: `MANUFACTURING_MANIFESTO`, `INDUSTRIAL_CATEGORIES`, `MATERIAL_PROPERTIES_TABLE`, `buildB2bWhatsappQuoteUrl(params: QuoteUrlParams): string`

- [ ] **Step 1: Write failing unit test for B2B copywriting module**
Create `tests/unit/b2b-copywriting.test.ts` verifying copy constants, categories matrix, and WhatsApp quote URL formatting with SKU and page tracking.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit tests/unit/b2b-copywriting.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/catalog/b2b-copywriting.ts`**
Implement technical copy, materials matrix, and WhatsApp message encoder.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test:unit tests/unit/b2b-copywriting.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/catalog/b2b-copywriting.ts tests/unit/b2b-copywriting.test.ts
git commit -m "feat(catalog): add technical B2B copywriting and WhatsApp deep link generator"
```

---

### Task 3: Motor de Geração PDF A4 de Alta Definição (Agente 4)

**Files:**
- Create: `lib/catalog/editorial-pdf-engine.ts`
- Test: `tests/unit/editorial-pdf-engine.test.ts`

**Interfaces:**
- Produces: `generateEditorialCatalogPdf(products: CatalogProductItem[], options: EditorialPdfOptions): Promise<Blob>`

- [ ] **Step 1: Write failing unit test for editorial PDF engine**
Create `tests/unit/editorial-pdf-engine.test.ts` verifying page count calculations, cover page geometry, and layout coordinate calculations.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit tests/unit/editorial-pdf-engine.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/catalog/editorial-pdf-engine.ts`**
Implement jsPDF engine with luxury cover, materials manifesto page, product grids (2x2, Hero+3, Detail, Tech List) with 15mm margins, and backcover with QR code.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test:unit tests/unit/editorial-pdf-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/catalog/editorial-pdf-engine.ts tests/unit/editorial-pdf-engine.test.ts
git commit -m "feat(catalog): implement high-resolution editorial A4 PDF engine"
```

---

### Task 4: Componentes de Visualização do Live Preview (Agente 2)

**Files:**
- Create: `app/app/(pro)/products/catalog/_components/parts/EditorialCard.tsx`
- Create: `app/app/(pro)/products/catalog/_components/views/WebSliderView.tsx`
- Create: `app/app/(pro)/products/catalog/_components/views/A4PrintSheetView.tsx`
- Test: `tests/unit/catalog-views.test.ts`

**Interfaces:**
- Produces: `EditorialCard`, `WebSliderView`, `A4PrintSheetView`

- [ ] **Step 1: Write failing unit test for catalog view components**
Create `tests/unit/catalog-views.test.ts` testing item partitioning per page for each layout.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit tests/unit/catalog-views.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement visual view components**
Build `EditorialCard` with technical stamps, `WebSliderView` for presentation carousel, and `A4PrintSheetView` for physical 1:1.414 page preview.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test:unit tests/unit/catalog-views.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add "app/app/(pro)/products/catalog/_components/parts/EditorialCard.tsx" "app/app/(pro)/products/catalog/_components/views/WebSliderView.tsx" "app/app/(pro)/products/catalog/_components/views/A4PrintSheetView.tsx" tests/unit/catalog-views.test.ts
git commit -m "feat(catalog): create Web Slider and A4 Print Sheet interactive preview components"
```

---

### Task 5: Painel de Controles & Integração no CRM (Agente 2)

**Files:**
- Create: `app/app/(pro)/products/catalog/_components/CatalogConfigSidebar.tsx`
- Modify: `app/app/(pro)/products/catalog/_components/CatalogEditorClient.tsx`
- Test: `tests/unit/catalog-editor-integration.test.ts`

**Interfaces:**
- Produces: Integrated split-view editor in `/app/products/catalog` with live controls, preview switching, and export triggers.

- [ ] **Step 1: Write unit test for editor config state and filter helpers**
Create `tests/unit/catalog-editor-integration.test.ts` testing state reducer and filter pipeline.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test:unit tests/unit/catalog-editor-integration.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `CatalogConfigSidebar.tsx` and update `CatalogEditorClient.tsx`**
Wire controls to live preview canvas, connect PDF export button, and enable WhatsApp showcase copy.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test:unit tests/unit/catalog-editor-integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add "app/app/(pro)/products/catalog/_components/CatalogConfigSidebar.tsx" "app/app/(pro)/products/catalog/_components/CatalogEditorClient.tsx" tests/unit/catalog-editor-integration.test.ts
git commit -m "feat(catalog): integrate split-view interactive editor with live controls in CRM"
```

---

### Task 6: Verificação Completa e Validação End-to-End

**Files:**
- Run: Full test suite & typecheck

- [ ] **Step 1: Run complete test suite**
Run: `npm run test:unit tests/unit/editorial-design-system.test.ts tests/unit/b2b-copywriting.test.ts tests/unit/editorial-pdf-engine.test.ts tests/unit/catalog-views.test.ts tests/unit/catalog-editor-integration.test.ts`
Expected: PASS

- [ ] **Step 2: Run typecheck**
Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 3: Browser validation report**
Document all completed features with evidence and present to user.
