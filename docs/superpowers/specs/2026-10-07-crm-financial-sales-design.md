# Design Specification: DeskcommCRM — Financeiro, DRE, Relatórios & Canais de Vendas

**Data**: 07 de Outubro de 2026  
**Status**: Proposto / Em Revisão  
**Foco**: Funcionalidades 100% reais, utilitárias e operacionais para o usuário final.

---

## 1. Visão Geral e Objetivos

O objetivo deste ciclo de desenvolvimento é transformar as abas **Financeiro & Relatórios** (`/app/control` e `/app/reports`) e **Vendas & Canais** (`/app/sales/shopee`, `/app/sales/mercado-livre`, `/app/sales/facebook`) em ferramentas 100% operacionais, sem telas estáticas ou placeholders.

### Garantias Principais:
- **100% Funcional**: Todo botão, formulário, seletor de data, tabela e gráfico estará conectado a Server Actions do Next.js e ao banco de dados Supabase com suporte a multi-tenancy.
- **DRE Dinâmico & Conciliação em 1-Clique**: O usuário pode gerenciar o caixa diário, alternar para a visão DRE gerencial, conciliar lançamentos com um clique e exportar arquivos CSV reais.
- **Gestão Real de Canais de Venda**: O usuário pode cadastrar suas credenciais de API (Shopee, Mercado Livre, Facebook), simular e receber pedidos via Webhook real em tempo real, atualizando o estoque e gerando lançamentos financeiros automaticamente.

---

## 2. Arquitetura e Estrutura de Banco de Dados

### 2.1 Atualização no Banco de Dados (`supabase/migrations/`)

#### A. Expansão da Tabela `financial_records`
- `status`: `'pending' | 'reconciled' | 'cancelled'` (Default `'reconciled'`).
- `net_cents`: `BIGINT` (Valor líquido em centavos após taxas).
- `platform_fee_cents`: `BIGINT` (Valor da taxa cobrada pelo marketplace).
- `reconciled_at`: `TIMESTAMPTZ` (Data/hora em que a conciliação foi confirmada).

#### B. Nova Tabela `sales_channel_integrations`
```sql
CREATE TABLE public.sales_channel_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('Shopee', 'Mercado Livre', 'Facebook')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  webhook_secret TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_channel_org_platform_unique UNIQUE (organization_id, platform)
);

-- RLS Isolation
ALTER TABLE public.sales_channel_integrations ENABLE ROW LEVEL SECURITY;
```

---

## 3. Especificação do Módulo Financeiro & Relatórios

### 3.1 Aba Controle Financeiro (`/app/control`)
1. **Grid Interativo com Edição Direta & Conciliação**:
   - Tabela com linhas editáveis: Data, Descrição, Categoria, Tipo (Receita/Despesa), Plataforma, Valor Bruto, Taxa, Valor Líquido e Status.
   - **Ação de Conciliação**: Checkbox em cada linha e botão "Conciliar Selecionados" na barra superior para liquidar pendências instantaneamente.
   - **Modo DRE Gerencial**: Switch no topo para alternar entre "Lançamentos Individuais" e "DRE Consolidado".
2. **Exportação de Dados**:
   - Botão **"Exportar CSV"** que gera um arquivo `.csv` codificado em UTF-8 com os lançamentos filtrados.

### 3.2 Aba Relatórios & Telemetria (`/app/reports`)
1. **Filtro de Período Personalizado**:
   - Seletor de Intervalo: Este Mês, Últimos 30 dias, Trimestre, Ano Atual ou Data Inicial/Final customizada.
2. **Métricas & Gráficos Interativos**:
   - Gráficos de Faturamento vs Despesas, Margem Líquida por Categoria e Origem de Vendas.
   - Cartões de KPI com variação percentual comparada ao período anterior.

---

## 4. Especificação do Módulo Vendas & Canais (`/app/sales/[platform]`)

### 4.1 Gestão de Credenciais e Configuração de API
- Cada sub-aba (`/app/sales/shopee`, `/app/sales/mercado-livre`, `/app/sales/facebook`) terá uma seção de **Configuração do Canal**:
  - Formulário seguro para salvar App Keys, Partner ID, Webhook Secrets.
  - Indicador visual de status (`Conectado`, `Desconectado`, `Aguardando Dados`).
  - URL do Webhook exclusiva gerada para o Tenant.

### 4.2 Simulador & Testador de Webhook no Painel
- Para que o usuário possa testar e ver o sistema funcionando imediatamente (mesmo sem conta empresarial paga ativa na Shopee/ML):
  - Botão **"Simular Pedido de Teste"**: Dispara um evento real no backend que cria a venda, deduz o estoque do produto correspondente e lança a receita no Financeiro.

### 4.3 Endpoints Webhook Produção (`/api/v1/webhooks/[platform]`)
- Endpoint HTTP POST para recepção automática de pedidos reais enviados pelas plataformas.
- Atualização em tempo real do Kanban de Vendas via revalidação de dados.

---

## 5. Validação e Testes Automáticos
- Testes unitários Vitest cobrindo:
  - Cálculo de DRE e agregação de receitas/despesas.
  - Conciliação em lote e atualização de status no Supabase.
  - Recebimento e validação de payloads de Webhook dos canais de venda.

---

## 6. Próximos Passos
Após aprovação desta especificação pelo usuário:
1. Executar a revisão interna do spec.
2. Acionar a skill `writing-plans` para gerar o plano de tarefas passo a passo.
3. Executar o plano via desenvolvimento orientado a subagentes/TDD.
