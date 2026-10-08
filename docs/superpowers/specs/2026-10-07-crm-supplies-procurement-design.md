# Design Specification: DeskcommCRM — Suprimentos, Insumos & Compras Automáticas

**Data**: 07 de Outubro de 2026  
**Status**: Proposto / Em Revisão  
**Foco**: Automação real de estoque, conciliação de compras com financeiro e fluxo de suprimentos.

---

## 1. Visão Geral e Objetivos

O objetivo deste módulo é integrar as abas **Inventário & Consumíveis** (`/app/inventory`) e **Fornecedores & Compras** (`/app/suppliers`) com as **Ordens de Serviço** (`/app/service-orders`) e o **Controle Financeiro** (`/app/control`), eliminando a necessidade de dupla entrada manual.

### Principais Garantias:
- **Baixa de Estoque por O.S.**: Ao concluir uma Ordem de Serviço, o peso em gramas do filamento/insumo é abatido automaticamente do inventário.
- **Lançamento Financeiro Automático**: Toda compra criada em `/app/suppliers` é gravada automaticamente como despesa no Controle Financeiro (`/app/control`).
- **Gerador de Cotação de Compras**: Ferramenta interativa em `/app/suppliers` para selecionar insumos com estoque baixo e gerar texto/PDF formatado para envio direto ao WhatsApp do fornecedor.
- **Ficha de Depreciação de Ativos**: Cálculo da depreciação linear das impressoras 3D e equipamentos com histórico de manutenções acumuladas.

---

## 2. Arquitetura e Estrutura de Banco de Dados

### 2.1 Atualização de Tabelas (`supabase/migrations/`)

#### A. Tabela `filaments` & `consumables`
- Garantir coluna `min_weight_alert` para disparar alertas visuais no dashboard e relatórios.

#### B. Tabela `supplier_purchases`
- Adicionar coluna `financial_record_id` (FK para `financial_records`) para vincular a compra diretamente à despesa correspondente.

---

## 3. Especificação do Módulo de Suprimentos & Insumos

### 3.1 Baixa de Estoque via Conclusão de O.S. (`app/actions/service-orders/actions.ts`)
- Quando `updateServiceOrderStatus(id, 'concluido')` é executado:
  - O sistema calcula o peso total de filamento exigido pelos itens da O.S.
  - Executa a baixa no inventário `filaments` do tenant.
  - Verifica se algum item atingiu o limite crítico (`weight_grams <= min_weight_alert`).

### 3.2 Lançamento Automático de Compras no Financeiro (`app/actions/suppliers/actions.ts`)
- Na Server Action `createPurchase(raw)`:
  - Além de inserir o registro em `supplier_purchases`, insere automaticamente um registro do tipo `'Despesa'` em `financial_records`.
  - Categoria definida como `'Insumo'` (para insumos/filamentos) ou `'Ferramentas'` (para peças de reposição).
  - Descrição: `[Compra Fornecedor] {itemName} ({supplierName})`.

### 3.3 Gerador de Pedido de Cotação (`app/app/(pro)/suppliers/_components/`)
- Modal **"Gerar Pedido de Cotação"**:
  - Lista automaticamente insumos com alerta de estoque baixo.
  - Permite selecionar a quantidade desejada.
  - Botão **"Enviar via WhatsApp"**: Abre a API do WhatsApp (`https://wa.me/...`) com a mensagem pré-formatada.
  - Botão **"Exportar Pedido PDF"**: Baixa o espelho de cotação formatado.

### 3.4 Ficha de Depreciação de Ativos (`app/app/(pro)/inventory/_components/`)
- Tabela de Maquinário:
  - Exibe o valor de compra original, tempo de uso, depreciação acumulada e valor residual estimado.
  - Indicador de saúde patrimonial da Oficina 3D.

---

## 4. Validação e Testes Automáticos
- Testes unitários Vitest cobrindo:
  - Abatimento de estoque ao concluir Ordem de Serviço.
  - Criação de despesa em `financial_records` ao salvar compra em `supplier_purchases`.
  - Cálculo de depreciação linear em `inventory_assets`.

---

## 5. Próximos Passos
Após aprovação do design:
1. Executar auto-revisão da especificação.
2. Invocar a skill `writing-plans` para gerar o plano de execução em tarefas TDD.
3. Executar o plano via desenvolvimento orientada a subagentes.
