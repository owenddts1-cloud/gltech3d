-- 0089_ai_agents_farm_system.sql
-- Tabela de impressoras, carretéis no domínio da massa (gramas), ordens fatiadas e jobs de produção da Farm 3D

-- 1. CAMPOS DE CONFIGURAÇÃO TARIFÁRIA EM ORGANIZATIONS
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS kwh_rate_brl NUMERIC(10, 4) NOT NULL DEFAULT 0.8500,
  ADD COLUMN IF NOT EXISTS default_hourly_labor_rate_brl NUMERIC(10, 2) NOT NULL DEFAULT 40.00;

-- 2. MACHINES (FARM NODES / PRINTERS)
CREATE TABLE IF NOT EXISTS public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  technology TEXT NOT NULL DEFAULT 'FDM' CHECK (technology IN ('FDM', 'Resina', 'SLA', 'SLS')),
  extrusion_type TEXT NOT NULL DEFAULT 'single_nozzle' CHECK (extrusion_type IN ('single_nozzle', 'multi_material', 'dual_extruder', 'toolchanger', 'resin_vat')),
  nozzle_diameter_mm NUMERIC(3, 2) NOT NULL DEFAULT 0.40,
  bed_size_x_mm NUMERIC(8, 2) NOT NULL DEFAULT 256.00,
  bed_size_y_mm NUMERIC(8, 2) NOT NULL DEFAULT 256.00,
  bed_size_z_mm NUMERIC(8, 2) NOT NULL DEFAULT 256.00,
  has_enclosure BOOLEAN NOT NULL DEFAULT FALSE,
  has_multi_material BOOLEAN NOT NULL DEFAULT FALSE,
  average_power_watts NUMERIC(8, 2) NOT NULL DEFAULT 150.00,
  acquisition_cost_brl NUMERIC(10, 2) NOT NULL DEFAULT 5000.00,
  residual_value_brl NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
  lifespan_hours NUMERIC(10, 2) NOT NULL DEFAULT 10000.00,
  maint_budget_brl NUMERIC(10, 2) NOT NULL DEFAULT 800.00,
  maint_interval_hours NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'preheating', 'printing', 'paused', 'maintenance', 'error', 'offline')),
  loaded_spool_id UUID,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_machines_org_status ON public.machines(organization_id, status);

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_machines_all ON public.machines;
CREATE POLICY tenant_isolation_machines_all ON public.machines
  FOR ALL USING (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  ) WITH CHECK (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  );
REVOKE ALL ON public.machines FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;

-- 3. SPOOLS INVENTORY / FILAMENT INVENTORY (CONTROLE ESTRITO EM GRAMAS)
CREATE TABLE IF NOT EXISTS public.spools_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  material TEXT NOT NULL,
  color TEXT NOT NULL,
  finish TEXT NOT NULL DEFAULT 'standard',
  brand TEXT NOT NULL,
  filament_diameter_mm NUMERIC(3, 2) NOT NULL DEFAULT 1.75,
  nominal_density_g_cm3 NUMERIC(5, 3) NOT NULL DEFAULT 1.240,
  gross_weight_g NUMERIC(10, 2) NOT NULL DEFAULT 1200.00,
  initial_weight_g NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
  remaining_weight_g NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
  reserved_weight_g NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  safety_tolerance_pct NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
  cost_per_kg NUMERIC(10, 2) NOT NULL DEFAULT 90.00,
  min_stock_alert_g NUMERIC(10, 2) NOT NULL DEFAULT 200.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_spool_mass_non_negative CHECK (remaining_weight_g >= 0.00),
  CONSTRAINT check_spool_reservation_valid CHECK (reserved_weight_g >= 0.00)
);
CREATE INDEX IF NOT EXISTS idx_spools_org_material ON public.spools_inventory(organization_id, material, color);

-- Add foreign key from machines to spools_inventory if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_machines_loaded_spool'
  ) THEN
    ALTER TABLE public.machines
      ADD CONSTRAINT fk_machines_loaded_spool
      FOREIGN KEY (loaded_spool_id)
      REFERENCES public.spools_inventory(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.spools_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_spools_all ON public.spools_inventory;
CREATE POLICY tenant_isolation_spools_all ON public.spools_inventory
  FOR ALL USING (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  ) WITH CHECK (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  );
REVOKE ALL ON public.spools_inventory FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spools_inventory TO authenticated;

-- 4. ORDERS & ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.ai_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'quoted', 'approved', 'in_production', 'qc_passed', 'shipped', 'completed', 'cancelled')),
  total_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_orders_org_customer ON public.ai_orders(organization_id, customer_id);

ALTER TABLE public.ai_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ai_orders_all ON public.ai_orders;
CREATE POLICY tenant_isolation_ai_orders_all ON public.ai_orders
  FOR ALL USING (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  ) WITH CHECK (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  );
REVOKE ALL ON public.ai_orders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_orders TO authenticated;

CREATE TABLE IF NOT EXISTS public.ai_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.ai_orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  gcode_url TEXT,
  net_mass_g NUMERIC(10, 2) NOT NULL,
  support_mass_g NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  switches_count INTEGER NOT NULL DEFAULT 0,
  print_time_hours NUMERIC(8, 4) NOT NULL,
  cost_material_brl NUMERIC(10, 2) NOT NULL,
  cost_machine_brl NUMERIC(10, 2) NOT NULL,
  cost_labor_brl NUMERIC(10, 2) NOT NULL,
  risk_factor NUMERIC(5, 4) NOT NULL DEFAULT 1.0000,
  final_price_brl NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_order_items_org_order ON public.ai_order_items(organization_id, order_id);

ALTER TABLE public.ai_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ai_order_items_all ON public.ai_order_items;
CREATE POLICY tenant_isolation_ai_order_items_all ON public.ai_order_items
  FOR ALL USING (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  ) WITH CHECK (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  );
REVOKE ALL ON public.ai_order_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_order_items TO authenticated;

-- 5. PRODUCTION JOBS / FILA DE PRODUÇÃO (PRODUCTION QUEUE)
CREATE TABLE IF NOT EXISTS public.ai_production_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.ai_orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.ai_order_items(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  spool_id UUID REFERENCES public.spools_inventory(id) ON DELETE SET NULL,
  allocated_agent TEXT NOT NULL DEFAULT 'FarmOrchestratorAgent',
  required_material TEXT NOT NULL DEFAULT 'PLA',
  required_color TEXT,
  estimated_mass_g NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  estimated_print_time_hours NUMERIC(8, 4) NOT NULL DEFAULT 0.00,
  priority_level TEXT NOT NULL DEFAULT 'normal' CHECK (priority_level IN ('urgent', 'normal', 'low')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'preheating', 'printing', 'completed', 'failed', 'aborted', 'pending', 'allocated', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 1,
  qc_passed BOOLEAN,
  qc_notes TEXT,
  qc_photo_urls TEXT[],
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_org_status ON public.ai_production_jobs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_org_priority ON public.ai_production_jobs(organization_id, priority_level, priority);

ALTER TABLE public.ai_production_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ai_jobs_all ON public.ai_production_jobs;
CREATE POLICY tenant_isolation_ai_jobs_all ON public.ai_production_jobs
  FOR ALL USING (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  ) WITH CHECK (
    organization_id IN (SELECT * FROM public.fn_user_org_ids())
  );
REVOKE ALL ON public.ai_production_jobs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_production_jobs TO authenticated;

-- 6. VIEWS DE CONVENIÊNCIA / ALIASES
CREATE OR REPLACE VIEW public.printers AS SELECT * FROM public.machines;
CREATE OR REPLACE VIEW public.farm_nodes AS SELECT * FROM public.machines;
CREATE OR REPLACE VIEW public.filament_inventory AS SELECT * FROM public.spools_inventory;
CREATE OR REPLACE VIEW public.production_queue AS SELECT * FROM public.ai_production_jobs;
