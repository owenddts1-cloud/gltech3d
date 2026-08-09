-- 0071_v_products_costed_energy_key
--
-- A tarifa de energia da org tinha DUAS chaves em `organizations.settings`:
--
--   * `k_energy` — a que a aplicação ESCREVE (campo "Tarifa Energia (R$/kWh)" no
--     dashboard) e a que TODOS os cinco leitores em TypeScript usam, sempre com
--     default 0.85, igual a `lib/pricing/engine.ts`.
--   * `kwh_rate` — lida apenas pela view `v_products_costed` (0055), com default
--     0.92. Nada no repositório escreve essa chave.
--
-- Ou seja: não é divergência de opinião sobre a tarifa, é um typo de contrato que
-- nunca teve efeito — a view não tem nenhum consumidor na aplicação. Converger
-- agora é barato; depois de alguém passar a ler a view, não seria.
--
-- Três coisas, todas conservadoras:
--   1. Backfill defensivo para clones que porventura tenham populado `kwh_rate`
--      por fora: copia o valor para `k_energy` SEM sobrescrever quem já o tem.
--      Mesmo número, agora visível e editável na interface.
--   2. A view passa a ler `k_energy` com `kwh_rate` como último recurso, e o
--      default cai de 0.92 para 0.85 para bater com o TypeScript.
--   3. A view passa a expor depreciação, insumos e total — antes calculava
--      metade da fórmula de `computeProductPricing`, o que a tornava enganosa
--      para quem a consultasse direto no SQL.
--
-- `kwh_rate` NÃO é removida de `settings`: é um jsonb compartilhado por várias
-- áreas do sistema e apagar chave alheia é risco sem retorno.
--
-- Idempotente: `update` com guarda e `create or replace view`.

-- 1) Backfill defensivo. Só age em quem tem kwh_rate e NÃO tem k_energy.
update public.organizations
   set settings = jsonb_set(
         coalesce(settings, '{}'::jsonb),
         '{k_energy}',
         to_jsonb((settings->>'kwh_rate')::numeric)
       )
 -- `->> is not null` em vez do operador `?`: alguns drivers tratam "?" como
 -- placeholder de bind e quebrariam a migration antes de o Postgres a ver.
 where (settings->>'kwh_rate') is not null
   and (settings->>'k_energy') is null
   -- Valor não numérico faria o cast estourar e derrubar a migration inteira.
   and (settings->>'kwh_rate') ~ '^[0-9]+(\.[0-9]+)?$';

-- 2 e 3) View convergida e completa.
-- `create or replace view` só permite ACRESCENTAR colunas no fim; as existentes
-- mantêm nome, tipo e ordem.
create or replace view public.v_products_costed as
select p.id, p.organization_id, p.name, p.sale_price_cents,
       p.filament_grams, p.print_time_seconds, p.category_id,
       c.name as category_name,
       -- material_cost: gramas × custo/grama do filamento vinculado
       round(p.filament_grams * coalesce(f.cost_per_gram, 0), 2) as material_cost,
       -- energy_cost: horas × potência_kW × tarifa_kWh da org.
       -- k_energy é a chave escrita pela UI; kwh_rate fica como último recurso
       -- para clone antigo. Default 0.85 = lib/pricing/engine.ts.
       round(
         (p.print_time_seconds / 3600.0)
         * (coalesce(pr.power_draw, 200) / 1000.0)
         * coalesce(
             (o.settings->>'k_energy')::numeric,
             (o.settings->>'kwh_rate')::numeric,
             0.85
           ),
       2) as energy_cost,
       -- depreciation_cost: horas × R$/h da impressora (default 0.40, igual ao TS)
       round(
         (p.print_time_seconds / 3600.0) * coalesce(pr.depreciation_per_hour, 0.40),
       2) as depreciation_cost,
       -- extras_cost: soma do BOM em `extra_costs` (centavos no jsonb → reais)
       round(coalesce((
         select sum((e->>'cost_cents')::numeric)
         from jsonb_array_elements(
           case when jsonb_typeof(p.extra_costs) = 'array'
                then p.extra_costs else '[]'::jsonb end
         ) as e
       ), 0) / 100.0, 2) as extras_cost,
       -- total_cost: a fórmula inteira, igual a computeProductPricing
       round(
         p.filament_grams * coalesce(f.cost_per_gram, 0)
         + (p.print_time_seconds / 3600.0)
           * (coalesce(pr.power_draw, 200) / 1000.0)
           * coalesce(
               (o.settings->>'k_energy')::numeric,
               (o.settings->>'kwh_rate')::numeric,
               0.85
             )
         + (p.print_time_seconds / 3600.0) * coalesce(pr.depreciation_per_hour, 0.40)
         + coalesce((
             select sum((e->>'cost_cents')::numeric)
             from jsonb_array_elements(
               case when jsonb_typeof(p.extra_costs) = 'array'
                    then p.extra_costs else '[]'::jsonb end
             ) as e
           ), 0) / 100.0,
       2) as total_cost
from public.products p
left join public.categories  c  on c.id = p.category_id
left join public.filaments   f  on f.client_id = p.filament_client_id
                               and f.organization_id = p.organization_id
left join public.printers    pr on pr.client_id = p.printer_client_id
                               and pr.organization_id = p.organization_id
left join public.organizations o on o.id = p.organization_id;
