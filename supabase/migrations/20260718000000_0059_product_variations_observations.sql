-- 0059_product_variations_observations
-- Produtos ganham dois campos:
--   `variations`   — grupos de atributos da vitrine, formato [{ "name": "Tamanho",
--                    "options": ["P","M","G"] }, ...]. Editável em Produtos e Landing Edit.
--   `observations` — nota INTERNA do CRM (cuidados de impressão, fornecedor…). NÃO
--                    aparece na landing.
-- Aditivo e idempotente — safe to re-apply. Não altera dados existentes.

alter table public.products
  add column if not exists variations   jsonb not null default '[]'::jsonb,
  add column if not exists observations text;
