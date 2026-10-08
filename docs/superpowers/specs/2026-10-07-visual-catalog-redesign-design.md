# Design Doc: Redesign do Catálogo Visual Editorial (4 Agentes)

**Status:** Approved  
**Author:** Equipe Multidisciplinar (UI/UX Editorial, Front-End, Copywriting B2B, Arquiteto de Software)  
**Date:** 2026-10-07  
**Module:** `/app/products/catalog` & `lib/catalog`  

---

## 1. Visão Geral & Filosofia

Transformar o recurso "Gerar Catálogo Visual" da GLTech3D de um gerador estático básico em uma ferramenta interativa e editorial de manufatura aditiva com estética escandinava e de engenharia automotiva (Anti-AI Aesthetic), sem clichês ou chavões.

A solução é articulada em 4 agentes integrados:
1. **Agente 1 (UI/UX & Design System Editorial):** Paletas Warm Studio e Monolith Dark, tipografia suíça rígida, selos de tolerância milimétrica (±0.05mm), tags de polímeros técnicos e paginação estilo publicação de design.
2. **Agente 2 (Front-End & Interatividade):** Interface de tela dividida (Split-View) no CRM com Live Preview em tempo real, alternador entre modo **Web Slider** e modo **Folha de Impressão A4**, seletor de templates de grid (2x2, Hero+3, 1x1 Editorial, Lista Técnica) e controles de customização.
3. **Agente 3 (Copywriting & Conversão B2B):** Estrutura de textos industriais de precisão, manifesto de manufatura aditiva, categorização fabril e gerador de deep links de WhatsApp com código de SKU e página para fechamento comercial.
4. **Agente 4 (Motor de Geração PDF A4 em Alta Resolução):** Engine de diagramação estrita A4 (210 x 297 mm, 15mm de margem), com Capa Editorial de Impacto, Sumário de Matérias-Primas, Miolo de Produtos sem quebras órfãs e Contracapa Institucional com QR Code dinâmico.

---

## 2. Agente 1: Design System & Tokens Editoriais

### 2.1 Paletas Cromáticas
- **Tema Warm Studio Minimalist (Light):**
  - Fundo principal: `#FAF8F5`
  - Superfícies / Cards: `#F4F0E8`
  - Tipografia de leitura: `#171615`
  - Bordas ultrafinas: `#E5E2DC`
  - Acento Técnico: Cobre / Bronze fosco `#9E5A38` ou Oliva Técnico `#4A5D4E`
  - Metadados e legendas: `#7A756D`
- **Tema Technical Studio Monolith (Dark):**
  - Fundo principal: `#0D0E11`
  - Superfícies / Cards: `#16181E`
  - Tipografia de leitura: `#F4F4F6`
  - Bordas ultrafinas: `#262933`
  - Acento Técnico: Âmbar Técnico `#F59E0B` ou Ciano Industrial `#06B6D4`
  - Metadados e legendas: `#8E929E`

### 2.2 Tipografia e Grid
- Títulos: Proporção áurea com tracking levemente negativo (`-0.02em`).
- Fórmulas, pesos e dados técnicos: Fonte monoespaçada (`font-mono`, Space Grotesk / Courier New no PDF) em caixa alta discreta.
- Carimbos técnicos:
  - `TOLERÂNCIA DIMENSIONAL: ±0.05mm`
  - `RESOLUÇÃO DE CAMADA: 0.12 - 0.28mm`
  - `GRAU DE POLÍMERO: Engenharia / FDM Industrial`

---

## 3. Agente 2: Front-End Interativo & Live Preview

### 3.1 Arquitetura de Componentes
```
app/app/(pro)/products/catalog/
├── page.tsx                             # Server Component com fetch de produtos
└── _components/
    ├── CatalogEditorClient.tsx          # Shell principal com gerenciamento de estado
    ├── CatalogConfigSidebar.tsx         # Painel esquerdo de controles e seleções
    ├── CatalogLivePreview.tsx           # Canvas central com renderização em tempo real
    ├── views/
    │   ├── WebSliderView.tsx            # Apresentação interativa estilo carrossel/tablet
    │   └── A4PrintSheetView.tsx         # Simulação de folha A4 com proporção 1:1.414
    └── parts/
        ├── EditorialCard.tsx            # Card de produto com variações de grid
        ├── CoverSheet.tsx               # Pré-visualização da Capa
        └── BackcoverSheet.tsx           # Pré-visualização da Contracapa
```

### 3.2 Modos de Visualização
- **Modo Web Slider:** Apresentação em tela cheia com navegação por teclado (setas), swipe touch e transições suaves de fade/slide.
- **Modo Folha de Impressão (A4):** Preview visual em escala de cada página A4 renderizada (zoom in/out, grid de miniaturas, margens e linhas guia de corte).

### 3.3 Opções de Customização
- Layout do Grid: `grid_2x2` (4 por pág.), `hero_plus_3` (1 hero + 3 menores), `editorial_detail` (1 por pág. com especificações completas) e `technical_list` (tabela de engenharia).
- Toggles: "Exibir Preço BRL" vs "Sob Consulta B2B", "Exibir Gramatura e Tempo", "Exibir Dimensões X/Y/Z", "Exibir QR Code SKU", "Incluir Capa & Contracapa".
- Branding: Upload ou URL de logo do cliente (para assinantes Calc3D PRO) ou logo padrão GLTech3D.

---

## 4. Agente 3: Copywriting de Conversão & Engenharia B2B

### 4.1 Manifesto & Textos Padrão
- Título Oficial: `"GLTech3D Manufatura Aditiva & Engenharia de Peças // Catálogo Técnico Geral 2026"`
- Manifesto de Fabricação:
  > "Peças produzidas em ambiente climatizado com controle ativo de umidade de filamento, calibração dinâmica de ressonância e repetibilidade milimétrica para lotes prototípicos e finais."
- 4 Categorias Industriais:
  1. *01. Prototipagem Rápida e Peças Funcionais*
  2. *02. Gabaritos, Berços e Ferramentais Industriais*
  3. *03. Peças Finais em Polímeros de Engenharia*
  4. *04. Séries Seriadas e Peças Customizadas*

### 4.2 Deep Links de WhatsApp com Rastreamento
Mensagem padronizada gerada no QR Code e no botão "Copiar Vitrine":
```text
Olá! Visualizei a peça [Nome da Peça] (SKU: [SKU]) na página [N] do Catálogo Técnico GLTech3D.
Gostaria de solicitar uma cotação técnica para [X] unidades no material [Polímero].
```

---

## 5. Agente 4: Motor de Geração PDF A4 de Alta Definição

### 5.1 Especificações da Folha A4
- Dimensões: 210mm x 297mm.
- Margens: 15mm (Superior, Inferior, Esquerda, Direita).
- Densidade: 300 DPI equivalente com renderização vetorial e posicionamento fracionário exato.
- Proteção contra quebra: cada card e tabela possui bounding-box pré-calculado; elementos nunca vazam entre páginas.

### 5.2 Estrutura do Documento
1. **Página 1 (Capa):** Design editorial assimétrico com logotipo, título, número de edição, foto hero do produto em destaque e carimbo técnico.
2. **Página 2 (Manifesto & Matérias-Primas):** Tabela comparativa de propriedades mecânicas (PLA, PETG, TPU, ABS, Resina) e manifesto de fabricação.
3. **Páginas 3 a N-1 (Miolo):** Grade selecionada pelo usuário com fotografias em alta resolução, carimbos de tolerância, dimensões, material e QR Code.
4. **Página N (Contracapa):** Contatos, canais de atendimento, WhatsApp com link direto, termos de garantia e certificações técnicas.
