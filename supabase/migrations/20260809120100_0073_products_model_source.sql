-- 0073_products_model_source
--
-- Marca a ORIGEM do modelo 3D de cada peça, e a licença quando houver.
--
-- POR QUE ISTO É NECESSÁRIO: vender a peça IMPRESSA e distribuir o ARQUIVO STL
-- são coisas juridicamente diferentes. Um pack de arquivos é obra derivada
-- redistribuída, e boa parte do catálogo é de personagem licenciado. Sem esta
-- marcação, "o que pode entrar no pack" viraria uma decisão tomada de memória a
-- cada vez — e uma hora sai errado.
--
-- Com a coluna, o filtro do pack é uma cláusula de query
-- (`model_source in ('proprio','livre')`), não um julgamento repetido.
--
-- Valores:
--   proprio       — modelado pela própria operação
--   livre         — licença que permite redistribuir (CC-BY, CC0, domínio público…)
--   terceiro      — de terceiro, sem permissão de redistribuir o arquivo
--   desconhecido  — ainda não classificado (DEFAULT)
--
-- BACKFILL = ZERO CLASSIFICAÇÕES. Todas as peças existentes nascem
-- `desconhecido`, de propósito: classificar o catálogo alheio seria inventar um
-- dado jurídico que só o dono da operação pode afirmar. O default é o valor mais
-- restritivo na prática — nada entra no pack até alguém marcar.
--
-- INTERNA: fica FORA de `PUBLIC_PRODUCT_COLUMNS` (lib/landing/repository.ts),
-- como `observations` (0059) e `buyer_profile` (0069).
--
-- Aditiva e idempotente.

alter table public.products
  add column if not exists model_source text not null default 'desconhecido';

alter table public.products
  add column if not exists model_license text;

comment on column public.products.model_source is
  'Origem do modelo 3D: proprio | livre | terceiro | desconhecido. Decide o que '
  'pode ser distribuido como ARQUIVO (pack de STL), o que e diferente de vender '
  'a peca impressa. Uso INTERNO: fora de PUBLIC_PRODUCT_COLUMNS.';

comment on column public.products.model_license is
  'Licenca ou fonte do modelo, em texto livre (ex.: "CC-BY 4.0 - printables.com/x"). '
  'Uso INTERNO.';

-- `add constraint if not exists` não existe; o padrão do repo (0041) é checar o
-- catálogo antes. O CHECK entra DEPOIS do default, então nenhuma linha existente
-- o viola — todas já valem 'desconhecido'.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_model_source_valid'
  ) then
    alter table public.products
      add constraint products_model_source_valid
      check (model_source in ('proprio', 'livre', 'terceiro', 'desconhecido'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_model_license_len'
  ) then
    alter table public.products
      add constraint products_model_license_len
      check (model_license is null or char_length(model_license) <= 500);
  end if;
end $$;

-- Consulta do que pode virar pack, para quem for construir a entrega depois.
comment on table public.products is
  'Catalogo de pecas: serve a tela de Produtos do CRM E a vitrine publica. '
  'Colunas de custo e as marcadas como internas nunca saem em '
  'PUBLIC_PRODUCT_COLUMNS (lib/landing/repository.ts). Arquivo so pode ser '
  'distribuido quando model_source in (proprio, livre).';
