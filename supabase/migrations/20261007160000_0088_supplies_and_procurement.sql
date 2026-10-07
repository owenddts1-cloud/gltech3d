-- Migration 0088: Add financial_record_id foreign key to supplier_purchases

ALTER TABLE public.supplier_purchases
  ADD COLUMN IF NOT EXISTS financial_record_id UUID REFERENCES public.financial_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_purchases_financial_record
  ON public.supplier_purchases (financial_record_id);
