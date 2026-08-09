-- 0070_landing_settings_links_fallback
--
-- PROBLEMA: `landing_settings.links` (os canais de venda da LOJA) nasceu com o
-- default '{}' e nada nunca o preencheu — só é gravado quando alguém edita a aba
-- Links à mão. Como todos os produtos semeados trazem canal próprio, a herança
-- implementada em `lib/landing/links.ts` nunca foi exercitada. Consequência: uma
-- peça criada pelo CRM ia para a vitrine SEM NENHUM botão de compra.
--
-- SOLUÇÃO SEM HARDCODE DE TENANT: deriva o link da loja do que já está no banco.
-- Para cada org e cada canal, o global é o valor MAIS REPETIDO entre os
-- `products.links`. Um link presente em ≥2 peças é, por definição, o da loja; um
-- que aparece uma vez só é deep link daquele anúncio e é descartado. Nenhum
-- tenant é citado — num clone com outro catálogo a regra vale igual, e em banco
-- novo (sem produtos) é no-op.
--
-- NUNCA SOBRESCREVE canal já configurado. Só preenche o que está ausente.
--
-- Portável em psql puro: CTE + função de janela, sem temp table e sem
-- BEGIN/COMMIT (o runner já envolve em transação). Idempotente: na segunda
-- execução não há canal vazio a preencher.

-- ── Passo 1 ────────────────────────────────────────────────────────────────
-- Remove chave com string vazia. `""` é "sem link", não um valor: mantê-la faria
-- o passo 2 achar que o canal já está configurado e não preencher nada.
update public.landing_settings
   set links = (
         select coalesce(jsonb_object_agg(t.k, t.v), '{}'::jsonb)
         from jsonb_each_text(links) as t(k, v)
         where coalesce(t.v, '') <> ''
       ),
       updated_at = now()
 where exists (
   select 1 from jsonb_each_text(links) as t(k, v) where coalesce(t.v, '') = ''
 );

-- ── Passo 2 ────────────────────────────────────────────────────────────────
-- Deriva e grava. `excluded.links || landing_settings.links` põe o derivado por
-- baixo: qualquer canal que a org já tenha vence, porque em jsonb o operando da
-- DIREITA prevalece.
with pairs as (
  select
    p.organization_id,
    k.key,
    k.value
  from public.products p
  cross join lateral jsonb_each_text(coalesce(p.links, '{}'::jsonb)) as k(key, value)
  where k.key in ('shopee', 'mercadoLivre', 'whatsapp', 'instagram')
    and coalesce(k.value, '') <> ''
),
tally as (
  select
    organization_id,
    key,
    value,
    count(*) as n,
    -- Desempate por `value` deixa o resultado determinístico: re-rodar noutro
    -- servidor não pode escolher um link diferente.
    row_number() over (
      partition by organization_id, key
      order by count(*) desc, value
    ) as rn
  from pairs
  group by organization_id, key, value
),
winner as (
  select
    organization_id,
    jsonb_object_agg(key, value) as links
  from tally
  where rn = 1
    and n >= 2
  group by organization_id
)
insert into public.landing_settings (organization_id, sections, links)
select w.organization_id, '{}'::jsonb, w.links
from winner w
on conflict (organization_id) do update
  set links = excluded.links || landing_settings.links,
      updated_at = now();

comment on column public.landing_settings.links is
  'Canais de venda da LOJA (shopee/mercadoLivre/whatsapp/instagram). Produto sem '
  'link proprio herda daqui: ver mergeProductLinks em lib/landing/links.ts.';
