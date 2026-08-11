-- =============================================================================
-- Migration 0077 — vínculo produto ↔ modelo 3D e proveniência da estimativa
-- =============================================================================
-- O QUE ISTO DESTRAVA. Os 18 produtos do catálogo têm `filament_grams = 0` e
-- `print_time_seconds = 0`. Sem esses dois números nenhum custo pode ser
-- calculado, e é daí que sai a "margem média 100%" da tela de Produtos e os
-- 95,5% da tela de Vendas — aritmética de custo zero, não lucro.
--
-- E não havia como preencher: não existia vínculo entre produto e arquivo. Com
-- `model_id`, a peça aponta para o STL, e o fatiador que já existe estima peso e
-- tempo sozinho — que é o motivo de ele ter sido construído.
--
-- `on delete set null` e NÃO `cascade`: apagar um STL do repositório não pode
-- apagar o produto que ele descreve. O produto é do catálogo, o arquivo é
-- insumo.

alter table public.products
  add column if not exists model_id uuid references public.models_3d(id) on delete set null;

-- Proveniência da estimativa. Sem isto, `filament_grams` preenchido pelo
-- fatiador fica indistinguível de um valor pesado na balança — e a diferença
-- importa: a peça real varia com preenchimento, suporte e falha de impressão.
alter table public.products
  add column if not exists cost_estimated_at timestamptz;

-- Como foi estimado: altura de camada, preenchimento, paredes, orientação. Fica
-- em jsonb porque o perfil do fatiador evolui, e travar colunas obrigaria
-- migration a cada parâmetro novo.
alter table public.products
  add column if not exists cost_estimate_source jsonb not null default '{}'::jsonb;

create index if not exists products_model_idx
  on public.products (organization_id, model_id)
  where model_id is not null;

comment on column public.products.model_id is
  'STL/3MF que gera esta peca. Alimenta a estimativa de gramas e tempo pelo fatiador.';
comment on column public.products.cost_estimated_at is
  'Quando gramas/tempo foram ESTIMADOS pelo fatiador. Nulo = valor informado a mao ou ausente.';
comment on column public.products.cost_estimate_source is
  'Perfil usado na estimativa (altura de camada, preenchimento, paredes, orientacao).';
