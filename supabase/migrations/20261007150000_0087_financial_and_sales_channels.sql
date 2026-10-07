-- Migration 0087: Expand financial_records status/fees & Add sales_channel_integrations table

-- 1. Expand financial_records table
ALTER TABLE public.financial_records
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'reconciled' CHECK (status IN ('pending', 'reconciled', 'cancelled')),
  ADD COLUMN IF NOT EXISTS net_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

-- Backfill net_cents from revenue_cents - expense_cents if net_cents is 0
UPDATE public.financial_records
SET net_cents = GREATEST(0, revenue_cents - expense_cents)
WHERE net_cents = 0 AND revenue_cents > 0;

-- 2. Create sales_channel_integrations table
CREATE TABLE IF NOT EXISTS public.sales_channel_integrations (
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

-- Index for multi-tenant query speed
CREATE INDEX IF NOT EXISTS idx_sales_channel_integrations_org
  ON public.sales_channel_integrations (organization_id);

-- Enable RLS
ALTER TABLE public.sales_channel_integrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS sales_channel_integrations_select ON public.sales_channel_integrations;
DROP POLICY IF EXISTS sales_channel_integrations_insert ON public.sales_channel_integrations;
DROP POLICY IF EXISTS sales_channel_integrations_update ON public.sales_channel_integrations;
DROP POLICY IF EXISTS sales_channel_integrations_delete ON public.sales_channel_integrations;

-- Tenant Isolation Policies
CREATE POLICY sales_channel_integrations_select ON public.sales_channel_integrations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY sales_channel_integrations_insert ON public.sales_channel_integrations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY sales_channel_integrations_update ON public.sales_channel_integrations
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY sales_channel_integrations_delete ON public.sales_channel_integrations
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships WHERE user_id = auth.uid()
    )
  );
