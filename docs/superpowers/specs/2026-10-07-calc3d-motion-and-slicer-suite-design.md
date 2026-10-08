# Especificação de Design: Calc3D PRO — Fatiamento, Motion Control & Precificação

**Data:** 2026-10-07  
**Status:** Aprovado para Planejamento de Implementação  
**Escopo:** Modernização da Calculadora Pública (`/calc3d-pro`) e Novo Wizard de Precificação do CRM (`/app/calculator`)

---

## 1. Visão Geral & Design System GLTech3D

A modernização da precificação 3D atende tanto à atração de clientes na vitrine pública quanto à operação técnica dos operadores de impressão dentro do CRM da GLTech3D.

### Paleta Visual Obrigatória
- **Background Geral (Landing Page & Conteúdo Claro):** Creme quente / Off-white (`#FAF8F5` ou `#F6F4EE`).
- **Superfícies Escuras (Card de Resultado & CRM):** Marrom Expresso profundo (`#241F1C` / `#1E1A17`) com fundo pontilhado industrial sutil.
- **Acentos & Destaques Primários:** Caramelo Dourado / Bronze (`#A27953` e `#C89666`).
- **Inputs & Superfícies Claras:** Branco puro (`#FFFFFF`) com bordas em bege neutro (`#E8E3DA`).
- **Cores Semânticas:**
  - Verde Lucro / Confirmação: `#16A34A` / `#22C55E`
  - Terracota / Risco / Falha / Déficit: `#E05D38` / `#EA580C`
  - Âmbar / Alerta de Prazo: `#F59E0B`
  - WhatsApp Oficial: `#25D366`
- **Acessibilidade:** Suporte rigoroso a `prefers-reduced-motion` com fallbacks imediatos.

---

## 2. Módulo 1: Motor de Extração de Arquivos 3D (`lib/slicer/3d-file-parser.ts`)

Execução puramente client-side no navegador do usuário, sem uploads desnecessários para a infraestrutura de backend.

### 2.1 Contratos de Dados
```ts
export interface SlicedFilamentInfo {
  id: number;
  type: string;            // PLA, PETG, ABS, TPU, etc.
  colorHex: string;        // #RRGGBB
  colorName?: string;
  weightGrams: number;
  lengthMeters?: number;
}

export interface Parsed3DFile {
  success: boolean;
  format: '3mf' | 'gcode' | 'stl';
  slicer: 'BambuStudio' | 'OrcaSlicer' | 'PrusaSlicer' | 'Cura' | 'Unknown';
  filename: string;
  totalTimeSeconds: number;
  totalWeightGrams: number;
  platesCount: number;
  filaments: SlicedFilamentInfo[];
  breakdown?: {
    wallsPct: number;
    infillPct: number;
    topBottomPct: number;
    brimSupportPct: number;
  };
  warning?: string;
}
```

### 2.2 Estratégia de Leitura
1. **`.3mf` (Bambu Studio, OrcaSlicer, PrusaSlicer):**
   - Utiliza `jszip` em memória.
   - Extrai metadados de `Metadata/slice_info.config`, `Metadata/plate_*.json` e arquivos correlatos.
   - Computa tempo em segundos (`prediction`), número de mesas (`plates`), peso em gramas e filamentos com cores hexadecimais.
2. **`.gcode` (Otimizado via Chunks de 64KB):**
   - Utiliza `file.slice(0, 65536)` (primeiros 64KB) e `file.slice(file.size - 65536, file.size)` (últimos 64KB).
   - Regex segmentados:
     - Cura: `;TIME:(\d+)` e `;Filament weight\s*=\s*([\d\.]+)` (ou comprimento via `;Filament used:\s*([\d\.]+)m`).
     - Prusa / Bambu / Orca: `; estimated printing time.*?=\s*(.+)` e `; filament used \[g\]\s*=\s*([\d\.]+)`.
3. **`.stl` (Geometria + Densidade Base):**
   - Identifica que o arquivo é uma malha bruta.
   - Exibe aviso informativo em terracota suave e calcula o volume geométrico em $cm^3$ via Three.js (`STLLoader` / parsing de buffers de triângulos), sugerindo peso com densidade base de 1,24 g/cm³ (PLA).

---

## 3. Módulo 2: Primitivas de Motion Control

Componentes reutilizáveis com animação acelerada por GPU (`motion/react`):

1. **`LaserDropzone.tsx`:**
   - Dropzone de arrastar e soltar arquivos com borda tracejada em bege neutro `#E8E3DA`.
   - Efeito drag over: borda caramelo `#A27953`, escala 1.01.
   - Efeito de scanner laser: linha luminosa horizontal (`h-[2px] bg-gradient-to-r from-transparent via-[#C89666] to-transparent shadow-[0_0_12px_#A27953]`) que desce e sobe verticalmente pela dropzone durante a leitura (~400ms).
   - Efeito de sucesso: badge verde/dourado de confirmação e disparo de pulso suave nos inputs.
2. **`NumberTicker.tsx`:**
   - Interpolação numérica fluida em ~300ms a cada alteração de input, rolando dígitos com visual ouro/âmbar.
3. **`MotionTabs.tsx`:**
   - Transição deslizante suave com `layoutId="activePresetPill"` e física orgânica entre atalhos de presets.

---

## 4. Módulo 3: Calculadora da Landing Page (`app/(marketing)/calc3d-pro/`)

Atualização de [CalculatorBlock.tsx](file:///c:/Users/Gui/Documents/GUILHERME/Claude/PROJETOS/gltech3d/app/%28marketing%29/calc3d-pro/_components/CalculatorBlock.tsx) sem alterar as fórmulas de precificação homologadas:

1. **Dropzone com Scanner:** Integrada logo no início de "Material e tempo", preenchendo automaticamente `pesoPeca` e `tempoImpressao`.
2. **Motion Tabs nos Presets:** Fundo caramelo deslizando suavemente entre Chaveiro, Peça técnica, Miniatura e Lote 10 un.
3. **Card Expresso Vivo (`#241F1C`):**
   - Preço sugerido animado com `NumberTicker`.
   - Barra de Custo vs. Lucro com física elástica `spring: { stiffness: 260, damping: 25 }`.
   - Anatomia do custo com barras reativas proporcionais.
   - Frase dinâmica *"Com esse lucro, cerca de X peças pagam a máquina"* com fade e translateY.
   - Modal de Conversão: Proposta por WhatsApp oficial ou e-mail, registrando lead no CRM.

---

## 5. Módulo 4: Wizard de 4 Etapas no CRM (`/app/calculator`)

Interface industrial com malha pontilhada (estilo Bancada.io):

### Etapa 1 / 4: Raio-X do Projeto ("O arquivo não mente")
- Upload de arquivos `.3mf` ou `.gcode`.
- 3 cards métricos em destaque:
  - **Massa:** Gramas de filamento (dourado `#C89666`).
  - **Tempo:** Horas de máquina (azul/ciano).
  - **Placas:** Quantidade de mesas (âmbar).
- Barra de decomposição multi-segmentada: paredes 53%, preenchimento 37%, topo e base 9%, brim 1%.
- Pill inferior: *"Cada grama e cada minuto, por placa."*

### Etapa 2 / 4: Vínculo com Estoque Real ("Ele casa cada filamento com o seu estoque")
- Layout de 2 colunas com conector visual SVG e check verde (`✓`):
  - *No Arquivo:* Swatch de cor, nome da cor detectada, hexadecimal e gramas consumidas.
  - *No seu Estoque:* Dropdown reativo buscando as bobinas e filamentos reais da organização com marca, tipo e custo R$/kg.
- Auto-matching por similaridade de cor e material.
- Pill inferior: *"Pelo custo médio do que você pagou. Você só confirma."*

### Etapa 3 / 4: Calculadora & CMV ao Vivo ("Custo real, não chute")
- Apuração automatizada:
  - **Materiais:** $\sum (\text{gramas}_i \times \text{custo\_kg}_i / 1000)$ dos filamentos vinculados.
  - **Máquina:** $\text{horas} \times [(\text{consumo\_W}/1000 \times \text{tarifa}) + \text{depreciação} + \text{manutenção}]$.
  - **Acabamento:** $\text{horas manuais} \times \text{taxa horária}$.
  - **CMV Total:** Em destaque branco puro.
  - **Preço Sugerido:** Em destaque ouro/âmbar com botões de markup rápido (`1.5x`, `2.0x`, `2.5x`, `3.0x`) ou margem livre.
  - **Lucro por hora:** Em destaque com indicador de rentabilidade.
- Pill inferior: *"Materiais + máquina + acabamento → preço sugerido."*

### Etapa 4 / 4: Análise de Viabilidade em Lote ("E se eu fizer [ N ] peças?")
- Simulação livre da quantidade do lote (ex: 10, 50, 100 peças).
- 4 barras dinâmicas de viabilidade:
  - **Estoque (Terracota / Verde):** Avalia se o estoque é suficiente ou quanto falta comprar em kg e R$.
  - **Prazo & Capacidade (Âmbar):** Horas totais e dias de produção divididos pelas impressoras ativas.
  - **Rentabilidade (Verde):** R$/h comparado à média da oficina.
  - **Meta Financeira:** Progresso em direção à meta de lucro estipulada.
- Ações Finais:
  - *Salvar como Proposta no CRM*
  - *Emitir Ordem de Serviço* (fila de produção da fazenda 3D)
  - *Gerar PDF com a sua Marca*

---

## 6. Arquitetura de Dados & Segurança
- Multi-tenancy com isolamento rigoroso por `organization_id` via RLS.
- Acesso à rota `/app/calculator` protegido por `assertProAccess`.
- Conexão nativa com `printers`, `filaments` e `organizations.settings`.

---

## 7. Critérios de Aceite & Validação
1. **Fórmulas Matemáticas Intactas:** Fórmulas de precificação existentes em `engine.ts` e `useCalculator.ts` mantêm seus valores exatos.
2. **Parser Resiliente:** Suporte verificado a arquivos `.3mf` do Bambu Studio e `.gcode` de Cura/Prusa.
3. **Motion Acessível:** Zero travamentos de thread principal, suporte a `prefers-reduced-motion`.
4. **Bateria de Testes:** 100% dos testes unitários passando no Vitest e `tsc --noEmit` zerado.
