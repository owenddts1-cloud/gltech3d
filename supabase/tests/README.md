# Testes de banco

Suítes SQL que verificam o que não dá para verificar em TypeScript: políticas RLS
e triggers. Ambas rodam **dentro de uma transação que termina em `rollback`**, então
são seguras contra o banco de produção — nenhuma linha sobrevive.

| Arquivo | O que garante |
|---|---|
| `rls-tenant-isolation.sql` | O gate que o `CLAUDE.md` exige: cria 2 organizações com 2 usuários e prova que um tenant não lê nem escreve dados do outro em `contacts`, `service_orders`, `service_order_items`, `service_order_documents`, `financial_records` e `marketplace_orders`. |
| `money-sync-triggers.sql` | As 8 invariantes da sincronização O.S. ↔ Venda ↔ Lançamento (migrations 0063-0066) e do recálculo por itens (0068). |

## Rodar

```bash
npm run test:db          # roda as duas
```

O script usa a CLI do Supabase (`supabase db query`), que resolve a conexão pelo
projeto vinculado. Para apontar para outro banco:

```bash
npx supabase db query --file supabase/tests/rls-tenant-isolation.sql --db-url "$DATABASE_URL"
```

Ou direto com `psql`, se preferir:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls-tenant-isolation.sql
```

## Como ler o resultado

Cada suíte falha com `raise exception` nomeando a invariante quebrada — por
exemplo `VAZOU: B enxerga 1 contato de A` ou `FALHOU 3: Venda nao acompanhou`.
Sucesso é a mensagem final (`ISOLAMENTO OK`, `SINCRONIZACAO OK`) e código de
saída zero.

## Por que SQL e não Playwright

O `tests/e2e/README.md` planejava um `tenant-isolation.spec.ts`. Um E2E provaria
que a *UI* não mostra dado do outro tenant — o que é mais fraco: a defesa real é
a RLS no banco, e ela precisa ser exercitada com dois JWTs de verdade, sem passar
pela aplicação. Estas suítes trocam de papel para `authenticated` e injetam
`request.jwt.claims`, que é exatamente o que o PostgREST faz em runtime.

## Por que não rodam no CI ainda

Precisam de credencial de banco. O `ci.yml` não recebe secrets de produção de
propósito. Para ligar: adicione `SUPABASE_DB_URL` aos secrets do repositório e um
step que chame `npm run test:db` — mas rode contra um banco de staging, não
contra produção, ainda que o rollback torne isso seguro.
