-- 0053_inventory_purpose
-- "Destino/Uso" por item: classifica cada ativo/consumível conforme para que ele serve
-- (ex.: Produção, Manutenção, Revenda, Consumo, Ferramenta, Peça, Insumo, Outro).
-- Texto livre (a UI sugere valores). Idempotent — safe to re-apply.

alter table public.inventory_assets add column if not exists purpose text;
alter table public.consumables     add column if not exists purpose text;
