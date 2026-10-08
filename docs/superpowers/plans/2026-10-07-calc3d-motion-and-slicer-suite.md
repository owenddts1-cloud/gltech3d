# Calc3D PRO — Motion Control, Parser 3D & Suite de Precificação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a esteira completa de fatiamento (.3mf, .gcode, .stl) e precificação 3D com Motion Control na Landing Page (`/calc3d-pro`) e o Wizard guiado em 4 etapas no CRM (`/app/calculator`), respeitando rigorosamente a paleta da GLTech3D.

**Architecture:** Módulo modular de parsing client-side com `jszip` e regex inteligente por chunks (64KB), componentes reutilizáveis de animação por GPU via `motion/react`, atualização fluida da calculadora pública sem alterar fórmulas matemáticas homologadas, e wizard em 4 passos conectado ao estoque real de bobinas e ordens de serviço.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, `motion/react` (Framer Motion), `jszip`, Three.js, Lucide/Phosphor Icons, Vitest.

**Spec:** [docs/superpowers/specs/2026-10-07-calc3d-motion-and-slicer-suite-design.md](file:///c:/Users/Gui/Documents/GUILHERME/Claude/PROJETOS/gltech3d/docs/superpowers/specs/2026-10-07-calc3d-motion-and-slicer-suite-design.md)

## Global Constraints
- Preservar estritamente a paleta GLTech3D: Creme quente `#FAF8F5`, Marrom Expresso `#241F1C`, Caramelo Dourado `#A27953` / `#C89666`, Bege `#E8E3DA`, Verde `#16A34A`, Terracota `#E05D38`.
- Não alterar as fórmulas matemáticas de precificação de `lib/pricing/engine.ts` e `hooks/calculator/useCalculator.ts`.
- Respeitar obrigatoriamente `prefers-reduced-motion` em todas as animações com fallback imediato.
- Execução do parser 100% client-side (no browser), sem envio de arquivos 3D pesados para o servidor.
- Multi-tenancy e isolamento por `organization_id` mantidos em todas as Server Actions e queries do CRM.

## Review Focus
- Leitura de arquivos `.3mf` corrompidos ou com metadados parciais não deve travar o navegador nem quebrar o app (retornar aviso amigável).
- Leitura de arquivos `.gcode` grandes (>100MB) deve ler estritamente os primeiros e últimos 64KB via `file.slice`.
- Usuários com `prefers-reduced-motion` ativado devem ver valores estáticos finais sem animações que causem desconforto.
- Valores de peças no wizard de lote com quantidade `0` ou negativa devem ser tratados e bloqueados com validação.
- Associação de cores do fatiador com o estoque do CRM deve ter fallback gracioso quando a oficina não tiver o filamento exato cadastrado.

---

### Task 1: Instalação de `jszip` & Motor de Fatiamento Client-Side (`lib/slicer/3d-file-parser.ts`)

**Files:**
- Create: `lib/slicer/3d-file-parser.ts`
- Test: `tests/unit/3d-file-parser.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `parse3DFile(file: File): Promise<Parsed3DFile>`
- Exported Types: `Parsed3DFile`, `SlicedFilamentInfo`

- [ ] **Step 1: Write the failing test**
  Criar `tests/unit/3d-file-parser.test.ts` testando:
  - Extração de `.gcode` Cura (`TIME:7200`, `Filament weight = 45.5`)
  - Extração de `.gcode` Prusa/Bambu (`estimated printing time = 3h 15m`, `filament used [g] = 120.4`)
  - Identificação de `.stl` com aviso pedagógico
  - Tratamento de arquivo sem metadados válidos

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/unit/3d-file-parser.test.ts`
  Expected: FAIL (module `lib/slicer/3d-file-parser` not found)

- [ ] **Step 3: Instalar `jszip` e implementar `lib/slicer/3d-file-parser.ts`**
  - Instalar `jszip` via pnpm (`pnpm add jszip && pnpm add -D @types/jszip`)
  - Implementar leitura parcial de `.gcode` (chunks de 64KB inicial e final)
  - Implementar parser de `.3mf` com `JSZip` varrendo `Metadata/slice_info.config` e `plate_*.json`
  - Implementar estimativa volumétrica geométrica para `.stl`

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run tests/unit/3d-file-parser.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add package.json pnpm-lock.yaml lib/slicer/3d-file-parser.ts tests/unit/3d-file-parser.test.ts
  git commit -m "feat(slicer): add client-side 3D file parser for 3mf, gcode and stl"
  ```

---

### Task 2: Primitivas de Motion Control (`LaserDropzone.tsx`, `NumberTicker.tsx`, `MotionTabs.tsx`)

**Files:**
- Create: `components/calc3d/LaserDropzone.tsx`
- Create: `components/calc3d/NumberTicker.tsx`
- Create: `components/calc3d/MotionTabs.tsx`
- Test: `tests/unit/calc3d-motion-primitives.test.ts`

**Interfaces:**
- `LaserDropzone`: `({ onFileParsed, disabled }: { onFileParsed: (data: Parsed3DFile) => void; disabled?: boolean })`
- `NumberTicker`: `({ value: number; prefix?: string; suffix?: string; className?: string })`
- `MotionTabs`: `({ tabs, activeTab, onChange })`

- [ ] **Step 1: Write the failing test**
  Criar `tests/unit/calc3d-motion-primitives.test.ts` testando a lógica de formatação do `NumberTicker`, os estados do `LaserDropzone` e os presets de `MotionTabs`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/unit/calc3d-motion-primitives.test.ts`
  Expected: FAIL (components not found)

- [ ] **Step 3: Implementar componentes em `components/calc3d/`**
  - Implementar `LaserDropzone.tsx` com estados idle, dragover, laser scanning beam animation e badge de sucesso.
  - Implementar `NumberTicker.tsx` com interpolação numérica via `motion/react` e fallback para `prefers-reduced-motion`.
  - Implementar `MotionTabs.tsx` com `layoutId="activePresetPill"` e física elástica.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run tests/unit/calc3d-motion-primitives.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add components/calc3d/ tests/unit/calc3d-motion-primitives.test.ts
  git commit -m "feat(ui): add calc3d motion control primitives with laser dropzone and number ticker"
  ```

---

### Task 3: Modernização da Calculadora da Landing Page (`app/(marketing)/calc3d-pro/`)

**Files:**
- Modify: `app/(marketing)/calc3d-pro/_components/CalculatorBlock.tsx`
- Create: `app/(marketing)/calc3d-pro/_components/LeadProposalModal.tsx`
- Test: `tests/unit/calc3d-pro-interactive.test.ts`

**Interfaces:**
- Consumes: `LaserDropzone`, `NumberTicker`, `MotionTabs`, `useCalculator`
- Produces: Visual enriquecido, dropzone integrada preenchendo `pesoPeca` e `tempoImpressao`, card expresso animado e modal de lead.

- [ ] **Step 1: Write the failing test**
  Criar `tests/unit/calc3d-pro-interactive.test.ts` validando a integração entre o drop de arquivo e a atualização dos inputs de peso/tempo sem distorcer as fórmulas originais.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/unit/calc3d-pro-interactive.test.ts`
  Expected: FAIL

- [ ] **Step 3: Atualizar `CalculatorBlock.tsx` e criar `LeadProposalModal.tsx`**
  - Integrar `LaserDropzone` no topo de "Material e tempo".
  - Trocar botões de preset convencionais por `MotionTabs`.
  - Atualizar card de resultado expresso (`#241F1C`) com `NumberTicker` no preço sugerido, barra spring elástica Custo vs. Lucro e animação na frase de ROI.
  - Criar `LeadProposalModal.tsx` para envio de proposta por WhatsApp oficial (`#25D366`) ou cadastro de lead.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run tests/unit/calc3d-pro-interactive.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add app/\(marketing\)/calc3d-pro/ tests/unit/calc3d-pro-interactive.test.ts
  git commit -m "feat(calc3d): upgrade public calculator with laser scanner, number ticker and lead modal"
  ```

---

### Task 4: Wizard 4 Etapas no CRM (`/app/calculator`) — Passo 1 (Raio-X) e Passo 2 (Vínculo de Estoque)

**Files:**
- Create: `app/app/(pro)/calculator/page.tsx`
- Create: `app/app/(pro)/calculator/_components/CalculatorWizardClient.tsx`
- Create: `app/app/(pro)/calculator/_components/Step1XRay.tsx`
- Create: `app/app/(pro)/calculator/_components/Step2StockLink.tsx`
- Test: `tests/unit/calculator-wizard-steps-1-2.test.ts`

**Interfaces:**
- Consumes: `fetchPrintersAndFilaments()`, `LaserDropzone`, `Parsed3DFile`
- Produces: Passo 1 (Raio-X com 3 métricas e barra de infill/paredes) e Passo 2 (conexão visual de cores do fatiador com estoque de filamentos reais do CRM).

- [ ] **Step 1: Write the failing test**
  Criar `tests/unit/calculator-wizard-steps-1-2.test.ts` testando o auto-match de cores e a extração dos dados no Passo 1 e 2.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/unit/calculator-wizard-steps-1-2.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implementar Passo 1 e Passo 2 do Wizard**
  - Implementar `Step1XRay.tsx`: visual industrial com grid pontilhado, exibição de `peca.gcode.3mf · lido ✓`, 3 cards métricos (Massa g, Horas de máquina, Placas), barra multi-segmentada de preenchimento/paredes.
  - Implementar `Step2StockLink.tsx`: colunas `NO ARQUIVO` vs `NO SEU ESTOQUE`, conectores visuais SVG, check verde `✓`, auto-matching de cores com o estoque real da organização.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run tests/unit/calculator-wizard-steps-1-2.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add app/app/\(pro\)/calculator/ tests/unit/calculator-wizard-steps-1-2.test.ts
  git commit -m "feat(crm-calc): implement wizard step 1 xray and step 2 stock linking"
  ```

---

### Task 5: Wizard 4 Etapas no CRM (`/app/calculator`) — Passo 3 (CMV ao Vivo) e Passo 4 (Viabilidade de Lote)

**Files:**
- Create: `app/app/(pro)/calculator/_components/Step3LiveCmv.tsx`
- Create: `app/app/(pro)/calculator/_components/Step4BatchFeasibility.tsx`
- Create: `app/actions/calculator/actions.ts`
- Modify: `app/app/(pro)/calculator/_components/CalculatorWizardClient.tsx`
- Test: `tests/unit/calculator-wizard-steps-3-4.test.ts`

**Interfaces:**
- Consumes: Filamentos vinculados do Passo 2, perfil de impressora ativa, taxa de energia.
- Produces: Passo 3 (CMV ao vivo, Preço sugerido com seletor de markup 1.5x / 2.0x / 2.5x / 3.0x, Lucro/hora) e Passo 4 (Simulação de lote com 4 barras dinâmicas, emissão de Proposta, OS e PDF).

- [ ] **Step 1: Write the failing test**
  Criar `tests/unit/calculator-wizard-steps-3-4.test.ts` testando o cálculo do CMV com filamentos múltiplos e a projeção de lote (dias de máquina e déficit de estoque).

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/unit/calculator-wizard-steps-3-4.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implementar Passo 3 e Passo 4 do Wizard & Server Actions**
  - Implementar `Step3LiveCmv.tsx`: apuração real de Materiais, Máquina e Acabamento, destaque do CMV, seletor de markup e lucro/hora.
  - Implementar `Step4BatchFeasibility.tsx`: input interativo de N peças, 4 barras de viabilidade (Estoque com alerta de déficit em kg/R$, Prazo/Capacidade em dias de oficina, Rentabilidade R$/h, Meta Financeira).
  - Implementar botões de conversão integrados: "Salvar como Proposta", "Emitir Ordem de Serviço" e "Gerar PDF com a sua Marca".

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run tests/unit/calculator-wizard-steps-3-4.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add app/app/\(pro\)/calculator/ app/actions/calculator/ tests/unit/calculator-wizard-steps-3-4.test.ts
  git commit -m "feat(crm-calc): implement wizard step 3 live cmv and step 4 batch feasibility"
  ```

---

### Task 6: Navegação no CRM, Suíte Completa de Testes & Verificação Final

**Files:**
- Modify: `components/shell/Sidebar.tsx`
- Test: Suíte completa (`npx vitest run`)
- Check: `npx tsc --noEmit`

- [ ] **Step 1: Integrar atalho da Calculadora na navegação do CRM**
  - Verificar se `/app/calculator` já consta na Sidebar ou adicionar link direto com ícone `Calculator` na seção de produção/orçamentos.

- [ ] **Step 2: Executar testes unitários de todas as novas frentes**
  Run: `npx vitest run tests/unit/3d-file-parser.test.ts tests/unit/calc3d-motion-primitives.test.ts tests/unit/calc3d-pro-interactive.test.ts tests/unit/calculator-wizard-steps-1-2.test.ts tests/unit/calculator-wizard-steps-3-4.test.ts`
  Expected: PASS em 100% dos testes.

- [ ] **Step 3: Executar typecheck global**
  Run: `npx tsc --noEmit`
  Expected: Exit code 0.

- [ ] **Step 4: Executar suíte completa do projeto**
  Run: `npx vitest run`
  Expected: Todos os testes (>1980 testes) verdes.

- [ ] **Step 5: Commit final de integração**
  ```bash
  git add components/shell/Sidebar.tsx
  git commit -m "feat(nav): integrate calc3d pro wizard into crm navigation"
  ```
