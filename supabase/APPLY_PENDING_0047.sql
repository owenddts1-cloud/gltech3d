-- =============================================================================
-- APLICAR PENDÊNCIA — migration 0047_my_sessions_rpc
-- =============================================================================
-- Cole no Supabase SQL Editor e clique em "Run". Idempotente.
-- =============================================================================

begin;

create or replace function public.fn_my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  not_after timestamptz,
  user_agent text,
  ip text
)
language sql
security definer
set search_path = auth, public
as $$
  select s.id, s.created_at, s.updated_at, s.not_after,
         s.user_agent, host(s.ip) as ip
  from auth.sessions s
  where s.user_id = auth.uid()
  order by s.updated_at desc nulls last
$$;

comment on function public.fn_my_sessions is
  'Sessões ativas do usuário autenticado (auth.uid()). Read-only.';

-- Só o usuário logado chama; anon não tem sessão.
revoke all on function public.fn_my_sessions() from public, anon;
grant execute on function public.fn_my_sessions() to authenticated;

commit;

-- CONFERÊNCIA:
--   select proname from pg_proc where proname = 'fn_my_sessions';  -- 1 linha
