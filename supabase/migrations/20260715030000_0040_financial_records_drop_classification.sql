-- 0040_financial_records_drop_classification
-- Funde a coluna Venda/Insumo dentro de Categoria.
--
-- Antes: `classification` (check Venda/Insumo/Outro) e `category` (texto livre) eram duas
-- colunas. Na prática `category` valia '(R) Renda Extra' em 100% das linhas — não classificava
-- nada — enquanto o sinal útil (Venda/Insumo) vivia em `classification`, presa a três valores
-- fixos pelo check constraint.
--
-- Depois: `category` passa a ser o único eixo de classificação, com rótulos livres geridos
-- pelo usuário na própria planilha (Venda, Insumo, Filamentos, Ferramentas, Outros...).
--
-- ORDEM DE APLICAÇÃO: publique o código que parou de escrever em `classification` ANTES de
-- rodar esta migration. O contrário quebra os inserts do código antigo.
--
-- Idempotente — safe to re-apply (o segundo run não acha mais a coluna e não faz nada).

-- 1) Salva o sinal útil antes de destruir a coluna. Sem isso a distinção Venda/Insumo some.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financial_records'
      and column_name = 'classification'
  ) then
    update public.financial_records
      set category = classification
      where classification is not null
        and classification <> '';
  end if;
end $$;

-- 2) Some com a coluna. O check constraint vai junto.
alter table public.financial_records
  drop column if exists classification;

comment on column public.financial_records.category is
  'Rótulo de classificação do lançamento (Venda, Insumo, Filamentos, Ferramentas, ...). '
  'Texto livre de propósito: o conjunto de rótulos é gerido pelo usuário na planilha.';
