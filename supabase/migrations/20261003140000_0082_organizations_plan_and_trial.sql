-- 0082 — plano e trial como COLUNAS de organizations.
--
-- Ate aqui o plano morava em `settings->>'plan'`: escrito por createTenant, lido
-- so pelo console de platform admin. Era aceitavel enquanto nao havia gate.
-- Agora ha: os modulos PRO travam de verdade e o trial de 7 dias precisa de uma
-- data. O CLAUDE.md lista `jsonb` lido por path como anti-padrao (#6), e esta
-- migration e o momento de pagar essa divida.
--
-- DIRC:
--   Duplicar  — relacao 1:1 com a org, entao coluna. Tabela 1:1 viraria JOIN
--               obrigatorio em loadAppShellContext(), que roda em TODO request
--               autenticado dos quatro layouts.
--   Integrar  — derivar de `pro_signup_requests`? Nao: aquela tabela e o livro
--               de PEDIDOS (zero linhas para quem so fez trial, N para quem
--               renovou). Varre-la a cada request para saber "esta org e PRO
--               agora" seria estado derivado por consulta (anti-padrao #5).
--   Referenciar — nao ha a que apontar.
--   Calcular  — `trial_days_left`, `expired` e `is_pro` SAO calculados, em
--               lib/plan/resolve.ts, e NAO entram no banco. So os dois fatos
--               entram: qual o plano e ate quando vale.
--
-- SEM INDICE de proposito: nenhum leitor varre por `plan` ou `trial_ends_at` —
-- toda leitura e por chave primaria (`eq('id', orgId)`). Indice sem leitor e o
-- mesmo desperdicio que evento sem consumer (anti-padrao #3). Quando existir o
-- cron de aviso de trial, ele traz o indice parcial na propria migration.
--
-- SEM POLICY NOVA, e isso e uma PROPRIEDADE DE SEGURANCA, nao esquecimento:
-- `orgs_select` ja libera leitura para membros da org, e as colunas novas
-- herdam. A ESCRITA em `organizations` continua restrita a platform admin por
-- `orgs_write_platform_admin` — e e exatamente essa policy que impede um `admin`
-- de tenant de se auto-promover a PRO via PostgREST com a anon key. NAO
-- acrescente policy de escrita aqui.

alter table public.organizations
  add column if not exists plan text not null default 'standard',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists plan_expires_at timestamptz;

-- Backfill ANTES da constraint (doutrina de migrations, item 8). O mesmo bloco
-- vai para o apendice do baseline, que o update.sh re-aplica sobre clones
-- possivelmente sujos e SEM ON_ERROR_STOP: criar o CHECK com dado violando-o
-- quebraria a atualizacao desses clones.
update public.organizations
   set plan = settings->>'plan'
 where plan = 'standard'
   and coalesce(settings->>'plan', '') <> '';

-- Normaliza o que nao e vocabulario conhecido (clone antigo pode ter qualquer
-- string em settings->>'plan').
update public.organizations
   set plan = 'standard'
 where plan is null
    or plan not in ('standard', 'pro', 'enterprise');

alter table public.organizations
  drop constraint if exists organizations_plan_check;
alter table public.organizations
  add constraint organizations_plan_check
  check (plan = any (array['standard', 'pro', 'enterprise']));

comment on column public.organizations.plan is
  'Plano vigente. standard = gratuito (Calculadora + Dashboard). Mesmo vocabulario de TenantPlan em lib/tenants/createTenant.ts. FONTE DA VERDADE — settings->>''plan'' e legado, mantido so para components/admin/tenants/TenantOverview.tsx.';
comment on column public.organizations.trial_ends_at is
  'Fim do trial de 7 dias do auto-cadastro. Fato historico: NAO e limpo quando a org vira paga.';
comment on column public.organizations.plan_expires_at is
  'Fim do acesso pago. NULL com plan=pro significa SEM EXPIRACAO — e o caso das orgs anteriores a esta migration, inclusive a da propria GLTech3D. lib/plan/resolve.ts depende disso para nao trancar quem ja pagava.';
