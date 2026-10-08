-- 0091_financial_transactions_cashflow_dre.sql
-- Módulo Financeiro Real: Vínculos com Pedidos e Farm, Contas a Pagar e View de Transações

-- 1. CAMPOS DE INTEGRAÇÃO CONTÁBIL, CPV E FLUXO DE CAIXA EM FINANCIAL_RECORDS
ALTER TABLE public.financial_records
  ADD COLUMN IF NOT EXISTS order_id UUID,
  ADD COLUMN IF NOT EXISTS production_job_id UUID,
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS pix_e2e_id TEXT,
  ADD COLUMN IF NOT EXISTS cpv_filament_cost_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpv_machine_cost_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_projected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE INDEX IF NOT EXISTS idx_financial_records_channel ON public.financial_records(organization_id, channel);
CREATE INDEX IF NOT EXISTS idx_financial_records_order ON public.financial_records(organization_id, order_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_due_date ON public.financial_records(organization_id, due_date);

-- 2. TABELA DE CONTAS A PAGAR (ACCOUNTS_PAYABLE - PREPARAÇÃO PARA SUPRIMENTOS/COMPRAS)
CREATE TABLE IF NOT EXISTS public.accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('filamentos', 'insumos_impressao', 'pecas_reposicao', 'energia', 'servicos', 'outros')),
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  payment_method TEXT NOT NULL DEFAULT 'pix',
  purchase_request_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_payable_org_status ON public.accounts_payable(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_org_due ON public.accounts_payable(organization_id, due_date);

ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_accounts_payable_all ON public.accounts_payable;
CREATE POLICY tenant_isolation_accounts_payable_all ON public.accounts_payable
  FOR ALL USING (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  ) WITH CHECK (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  );

REVOKE ALL ON public.accounts_payable FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_payable TO authenticated;

-- 3. VIEW DE COMPATIBILIDADE E AUDITORIA (FINANCIAL_TRANSACTIONS)
CREATE OR REPLACE VIEW public.financial_transactions AS
  SELECT
    id,
    organization_id,
    date,
    due_date,
    month,
    quantity,
    description,
    type,
    category,
    channel,
    payment_method,
    pix_e2e_id,
    order_id,
    production_job_id,
    revenue_cents,
    expense_cents,
    platform_fee_cents,
    net_cents,
    cpv_filament_cost_cents,
    cpv_machine_cost_cents,
    status,
    reconciled_at,
    is_projected,
    installments,
    platform,
    custom_fields,
    created_by,
    created_at,
    updated_at
  FROM public.financial_records;
