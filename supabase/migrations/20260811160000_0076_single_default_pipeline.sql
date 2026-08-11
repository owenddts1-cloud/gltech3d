-- =============================================================================
-- Migration 0076 — no máximo um pipeline default por organização
-- =============================================================================
-- ACHADO QUE MOTIVOU. A tela `/app/kanban` mostrava duas linhas idênticas
-- ("Pedidos · Default · /pedidos"). A auditoria externa leu isso como rota
-- quebrada apontando para 404; não é — o link vai para `/app/pipelines/<id>`,
-- que existe, e o "/pedidos" exibido é o SLUG como texto.
--
-- O defeito real é dado: duas linhas em `crm_pipelines`, mesmo nome, mesmo slug,
-- e **as duas com `is_default = true`**. Isso é violação de invariante, e o
-- estrago não fica na tela: qualquer código que resolva o pipeline padrão com
-- `.eq('is_default', true).single()` estoura, e com `.limit(1)` escolhe um dos
-- dois sem critério — o lead cai num funil hoje e no outro amanhã.
--
-- O QUE ESTA MIGRATION NÃO FAZ: apagar o pipeline duplicado. Apagar linha é
-- destrutivo e a decisão de qual manter é do dono da operação — os dois têm 8
-- estágios. Aqui só se garante que **um** seja o padrão; o outro continua
-- existindo, acessível, e pode ser removido ou renomeado pela interface.

-- 1) Conserta o dado ANTES da constraint: mantém como padrão o MAIS ANTIGO de
--    cada organização e desmarca os demais. O mais antigo é o que provavelmente
--    já foi referenciado por algo, então é o de menor risco.
with ranked as (
  select id,
         row_number() over (
           partition by organization_id
           order by created_at asc, id asc
         ) as rn
    from public.crm_pipelines
   where is_default
)
update public.crm_pipelines p
   set is_default = false
  from ranked r
 where p.id = r.id
   and r.rn > 1;

-- 2) Índice único PARCIAL: impede que dois voltem a ser padrão.
--
-- Parcial (`where is_default`) e não único simples sobre a coluna, porque
-- `false` se repete legitimamente — uma organização tem N pipelines não-padrão.
-- A restrição só vale para a linha marcada.
create unique index if not exists crm_pipelines_one_default_per_org
  on public.crm_pipelines (organization_id)
  where is_default;
