-- 0054_printers_status_telemetry
-- Status "maintenance" (Em manutenção) + config de leitura por IP nas impressoras.
-- `api_key`  → OctoPrint (X-Api-Key). `poll_mode` → como ler o status ao vivo:
--   'browser' (fetch do navegador na LAN), 'server' (server action p/ IP público), 'off'.
-- Idempotent — safe to re-apply.

alter table public.printers drop constraint if exists printers_status_check;
alter table public.printers add constraint printers_status_check
  check (status in ('idle', 'printing', 'error', 'offline', 'maintenance'));

alter table public.printers add column if not exists api_key text;
alter table public.printers add column if not exists poll_mode text not null default 'browser';
alter table public.printers drop constraint if exists printers_poll_mode_check;
alter table public.printers add constraint printers_poll_mode_check
  check (poll_mode in ('browser', 'server', 'off'));
