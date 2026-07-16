-- 0037_financial_records_platform
-- Add platform column to financial_records.

ALTER TABLE public.financial_records 
  ADD COLUMN IF NOT EXISTS platform text 
  CHECK (platform IN ('B2B', 'Shopee', 'Facebook', 'Mercado Livre', 'TikTok Shop', 'Olx', '', 'Outro') OR platform IS NULL);
