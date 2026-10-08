# Opção 3: Módulo Financeiro & Fluxo de Caixa Real do CRM — Design Spec

**Data:** 2026-10-07  
**Status:** Approved for Implementation  
**Autor:** Antigravity AI Pair Programming  

---

## 1. Visão Geral e Objetivos de Negócio

Com a esteira de pedidos do site (E-commerce de Filamentos e Pedidos Personalizados) capturando receitas via Pix e Cartão, e a Farm 3D apurando consumo real de filamento em gramas ($g$) e tempo de máquina, o Módulo Financeiro fecha o ciclo gerencial da GLTech3D com métricas contábeis reais de lucratividade e auditoria.

### Pilares de Negócio:
1. **Contabilidade e Transações Automatizadas (`financial_transactions` / `financial_records`):**
   - Entrada automática de receitas para pedidos pagos em `/app/pedidos-site` (Pix, Cartão, WhatsApp).
   - Apuração e débito automático de CPV/CMV: custo de matéria-prima (gramas consumidas $\times$ custo unitário da bobina ativa) e horas de máquina apuradas pela Farm 3D.
   - Registro de despesas operacionais manuais e recorrentes (energia elétrica, manutenção, insumos de bancada).
2. **DRE Gerencial em Tempo Real (`/app/financeiro/dre`):**
   - Cascata contábil estrita:
     - (+) Receita Bruta (Vendas do Site + Impressão 3D sob Demanda)
     - (-) Taxas de Pagamento e Plataforma
     - (=) Receita Líquida
     - (-) Custos Diretos de Produção (CPV: Filamentos consumidos + Energia/Depreciação de Máquina)
     - (=) Margem de Contribuição
     - (-) Despesas Fixas e Operacionais
     - (=) Lucro Líquido Operacional
   - Filtros dinâmicos: Período (diário, semanal, mensal) e Canal (`site_filaments` vs. `demand_printing` vs. `b2b`).
3. **Fluxo de Caixa & Conciliação (`/app/financeiro/fluxo-caixa`):**
   - Extrato bancário e conciliação de chaves Pix e pedidos liquidados.
   - Painel com projeção de entradas e saídas previstas (D+1, D+7, D+30).
4. **Preparação para Compras e Suprimentos (`accounts_payable`):**
   - Estrutura completa de Contas a Pagar com categorias de insumos e fornecedores, auditável para requisições automáticas do `InventorySentinelAgent`.

---

## 2. Modelagem de Dados (Migration 0091)

### 2.1 Colunas Adicionais em `financial_records` & View `financial_transactions`
- `order_id`: UUID para vincular a pedidos de filamento / site (`filament_orders` / `ai_orders`).
- `production_job_id`: UUID para vincular a jobs concluídos da Farm (`ai_production_jobs`).
- `channel`: `TEXT` (`site_filaments`, `demand_printing`, `whatsapp`, `shopee`, `mercado_livre`, `b2b`, `manual`).
- `payment_method`: `TEXT` (`pix`, `credit_card`, `bank_slip`, `cash`, `other`).
- `pix_e2e_id`: `TEXT` (identificador único End-to-End da transação Pix).
- `cpv_filament_cost_cents`: `BIGINT DEFAULT 0` (custo direto de filamento).
- `cpv_machine_cost_cents`: `BIGINT DEFAULT 0` (custo direto de máquina e energia).
- `is_projected`: `BOOLEAN DEFAULT FALSE` (para previsões de fluxo de caixa futuro).
- `due_date`: `DATE` (data de vencimento/projeção).

### 2.2 Tabela `accounts_payable` (Contas a Pagar)
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id`: `UUID REFERENCES organizations(id) ON DELETE CASCADE`
- `supplier_id`: `UUID REFERENCES suppliers(id) ON DELETE SET NULL`
- `supplier_name`: `TEXT NOT NULL`
- `category`: `TEXT NOT NULL` (`filamentos`, `insumos_impressao`, `pecas_reposicao`, `energia`, `servicos`, `outros`)
- `description`: `TEXT NOT NULL`
- `amount_cents`: `BIGINT NOT NULL`
- `due_date`: `DATE NOT NULL`
- `status`: `TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled'))`
- `paid_at`: `TIMESTAMPTZ`
- `payment_method`: `TEXT`
- `purchase_request_id`: `UUID`
- RLS Policies isolando estritamente por `organization_id`.

---

## 3. Arquitetura de Software & Server Actions

1. `app/actions/financial/transactions.ts`:
   - `recordOrderRevenueAction`: Grava receita de pedido pago com método de pagamento e canal.
   - `recordFarmJobCostAction`: Grava lançamento de CPV ao término do job com o custo exato em centavos de massa e máquina.
   - `createExpenseAction`: Cria despesas manuais ou recorrentes com categoria e data de vencimento.
2. `app/actions/financial/dre.ts` & `lib/financial/dre-engine.ts`:
   - `computeRealtimeDRE`: Computa a cascata contábil completa baseada nas transações da organização no período selecionado.
3. `app/actions/financial/cashflow.ts`:
   - `fetchCashflowSummary`: Retorna saldo atual, total conciliado, total pendente e projeções futuras (entradas e saídas previstas).
   - `reconcilePixTransaction`: Concilia lançamento com comprovante/chave Pix.
4. `app/actions/financial/payable.ts`:
   - `fetchAccountsPayable`, `createAccountPayable`, `markPayableAsPaid`.

---

## 4. Telas & Componentes de UI

1. `/app/financeiro/dre`:
   - Cards com indicadores-chave (Receita Bruta, CPV, Margem de Contribuição %, Custos Fixos, Lucro Líquido Operacional).
   - Tabela em cascata com detalhamento contábil.
   - Filtros: Período (Hoje, Esta Semana, Este Mês, Trimestre) e Canal (Todos, Venda de Filamentos, Peças sob Demanda).
2. `/app/financeiro/fluxo-caixa`:
   - Gráfico/Barras de projeção temporal (Entradas vs. Saídas).
   - Extrato de conciliação Pix com botão de conciliação em 1 clique.
3. `/app/financeiro/contas-pagar`:
   - Tabela de contas a pagar com status (`Pendente`, `Aprovado`, `Pago`).
   - Modal de nova despesa / conta a pagar.

---

## 5. Critérios de Aceitação & Testes

- Migração 0091 idempotente e reversível com teste de drift.
- Testes unitários para o cálculo de DRE e apuração de CPV em centavos.
- Testes para as Server Actions de receitas automáticas e conciliação Pix.
- 0 erros em `npx tsc --noEmit`.
