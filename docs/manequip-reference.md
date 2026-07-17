# Referência Manequip 360 → CRM GLTech3D

Copy das ideias das telas do **Manequip 360** (sistema de manutenção industrial do Guilherme)
que servem de referência visual/funcional para o CRM. A 1ª tela enviada (laranja) é o CRM atual;
as demais (teal/azul) são o Manequip.

Este documento é a fonte da verdade do que estamos replicando. Cada linha vira feature no CRM.

## Mapa imagem → ideia → aplicação

### 1. CRM atual (Visão geral, laranja)
Baseline. Area de faturamento + barras de fluxo de O.S. + KPIs. Ponto de partida.

### 2. Manequip — Visão Geral
- **KPI cards com badge de status** no canto (ex.: "Cadastrados", "SKUs ativos", "Em aberto",
  "Agendadas") e um número grande + subtexto crítico ("94 Críticos", "26 Pendentes").
- Painel **"Análise de Chamados"** com **donut central** (número no meio) e, no cabeçalho,
  **seletor de tipo de gráfico** + seletor de **mês** + **ano** + **tipo** (Preventivas/etc.).
- Lista lateral **"Próximas Preventivas"** com data, ativo e badge de status.
- Barras **"Previstas vs Realizadas"** com rótulo de valor em cada barra.
> CRM: KPIs com badge; painel de gráfico com seletor de tipo + filtros; lista lateral de
> próximas O.S.; barras com rótulo.

### 3. Manequip — Dropdown de tipos de gráfico
Menu com **Rosca / Pizza 2D / Pizza 3D / Barras / Colunas 3D / Histograma**.
> CRM: `DynamicChart` com esse seletor (mais Linha e Área).

### 4. Manequip — Previstas vs Realizadas / Evolução Mensal
- **Barras agrupadas** com rótulo de valor acima de cada barra.
- Toggle de série **TODOS / PREVENTIVAS / CORRETIVAS**.
- Par de cores semântico (Corretiva vermelho, Preventiva claro).
> CRM: rótulos nas barras; **chips de filtro de série**; cores semânticas (receita verde,
> despesa vermelho).

### 5. Manequip — Status de Chamados Gerais (empilhado) + Chamados por Técnico
- **Tooltip custom** (cabeçalho do mês + linhas por série).
- Barras **empilhadas** (Concluído/Em atendimento/Pendente) com **linha de total** pontilhada
  por cima, e toggle **EMPILHADO / LINHAS**.
- **Barras horizontais** por técnico (ranking), com total à direita.
> CRM: toggle empilhado/linhas; tooltip rico; ranking horizontal (receita por cliente,
> vendas por canal).

### 6. Manequip — Status em modo Linhas
Mesma base do item 5 renderizada como **linhas/área suaves com pontos** (troca instantânea).
> CRM: modo linha do mesmo dataset via o toggle.

### 7. Manequip — Chamados Recentes / Chamados em Atraso
- Tabelas com botões **CSV** e **XLS**.
- Filtro no cabeçalho, badges de status, coluna "tempo de atraso" destacada.
> CRM: tabelas de relatório com export (CSV/XLSX) + badges de status.

### 8. Manequip — Gestão de Projetos (Visão Geral)
- **Consolidado financeiro do portfólio**: Previsto / Faturado / Desvios / Projetos ativos-críticos.
- **Linha de tendência com projeção** (Faturado Real / Previsto Escopo / Tendência — meses
  futuros marcados "(Proj)").
- **Desvios por categoria** (Materiais / Mão de Obra / Serviços) com % e valor.
- Tabela **por projeto** (Previsto / Faturado / Margem-Desvio / Cronograma %) com ações
  **Acessar / Editar**; botões Relatório / Importar Planilha / Exportar / Novo Projeto.
> CRM: painel financeiro por projeto + drill-down por projeto + export.

### 9. Manequip — Quadro Branco (Gestão de Projetos)
- **Canvas** com **raias/fases**, **post-its arrastáveis**, botões **Novo Post-it / Nova Fase**,
  controles de **zoom (+/‑) / 100% / Reset**, e **seletor de quadro** por projeto.
- Dica: "Arraste notas entre raias. Clique duas vezes para editar/excluir."
> CRM (Fase 2): evoluir o "Quadro de Ideias" de Projetos para esse canvas.

### 10. Manequip — Business Intelligence & Relatórios
- Página com **tabs**: Geral & Custos / Saúde de Ativos / Técnicos & Eficiência / Inventário & Peças.
- Botões **Imprimir PDF** + **Exportar Planilha**; filtros de setor e mês.
- **KPI cards com badge** (BOM / ATENÇÃO), gráfico **estoque vs mínimo**, **alertas críticos**,
  **capital por categoria (Top 5)**, **peças de maior valor**.
> CRM: estrutura da página de Relatórios em tabs + export (PDF/planilha) + KPIs com badge.

## Fases de implementação no CRM
- **Fase 1 (gráficos):** `DynamicChart` (ECharts, seletor de tipo + toggles + animação + drill-down),
  breakdowns (cliente/categoria/projeto/canal), export CSV/XLSX/PDF em Relatórios; depois Dashboard e Controle.
- **Fase 2 (quadro branco):** canvas de briefing evoluindo o Quadro de Ideias de Projetos.
