-- 0069_products_buyer_profile
--
-- Adiciona `products.buyer_profile`: anotação em texto livre de QUEM costuma
-- comprar a peça ("mães de aluno", "colecionador de anime 18-30", "escritório").
-- Alimenta a decisão comercial e serve de briefing para a geração de conteúdo.
--
-- INTERNA, DE PROPÓSITO. É irmã de `products.observations` (0059): dado de
-- operação, não copy de vitrine. Não entra em `PUBLIC_PRODUCT_COLUMNS`
-- (lib/landing/repository.ts), que é uma lista explícita e fechada justamente
-- para que acrescentar coluna aqui não vaze na landing por acidente.
-- A assimetria manda começar interno: publicar depois custa duas linhas;
-- despublicar depois de o texto já ter ido ao ar, não.
--
-- Aditivo e idempotente — pode ser re-aplicada sem efeito duplicado.
-- BACKFILL = ZERO LINHAS: a coluna nasce nula em todas as linhas existentes.
-- Nenhum valor é inventado; quem preenche é o usuário, peça a peça.

alter table public.products
  add column if not exists buyer_profile text;

comment on column public.products.buyer_profile is
  'Perfil de quem costuma comprar esta peca. Uso INTERNO do CRM: nunca vai para a '
  'landing publica (a lista de colunas publicas e fechada em lib/landing/repository.ts).';

-- `add constraint if not exists` não existe no Postgres; o padrão do repo (0041)
-- é checar o catálogo antes.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_buyer_profile_len'
  ) then
    alter table public.products
      add constraint products_buyer_profile_len
      check (buyer_profile is null or char_length(buyer_profile) <= 2000);
  end if;
end $$;
