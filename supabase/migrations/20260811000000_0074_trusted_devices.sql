-- =============================================================================
-- Migration 0074 — user_trusted_devices
-- =============================================================================
-- Permite que usuários confiem em dispositivos para pular o desafio de TOTP (MFA)
-- e gerenciem/aprovem sessões/dispositivos em /app/settings/security.

CREATE TABLE IF NOT EXISTS public.user_trusted_devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token_hash   text NOT NULL,
  device_name         text NOT NULL,
  ip_address          text,
  user_agent          text,
  status              text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'revoked')),
  approved_at         timestamptz DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  last_used_at        timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON public.user_trusted_devices(user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_hash ON public.user_trusted_devices(device_token_hash);

ALTER TABLE public.user_trusted_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_trusted_devices_select" ON public.user_trusted_devices;
CREATE POLICY "user_trusted_devices_select" ON public.user_trusted_devices
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_trusted_devices_insert" ON public.user_trusted_devices;
CREATE POLICY "user_trusted_devices_insert" ON public.user_trusted_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_trusted_devices_update" ON public.user_trusted_devices;
CREATE POLICY "user_trusted_devices_update" ON public.user_trusted_devices
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_trusted_devices_delete" ON public.user_trusted_devices;
CREATE POLICY "user_trusted_devices_delete" ON public.user_trusted_devices
  FOR DELETE USING (auth.uid() = user_id);
