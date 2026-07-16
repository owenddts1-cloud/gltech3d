-- 0038_financial_records_custom_fields
-- Add custom_fields jsonb column to financial_records.

ALTER TABLE public.financial_records 
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;
