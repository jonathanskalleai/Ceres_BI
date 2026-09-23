# Runbook — remoção dos overloads ambíguos do BI

**Status:** aplicado e validado em produção em 23/09/2026 UTC.

**Escopo:** aplicar somente as duas migrations locais abaixo na VPS de
produção, depois validar o contrato HTTP/RPC:

- `supabase/migrations/20260922_remove_ambiguous_rpc_desempenho_vendas_overload.sql`
- `supabase/migrations/20260922_remove_ambiguous_acoes_gpo_overloads.sql`

As migrations foram transacionais, usaram `DROP FUNCTION ... RESTRICT`,
validaram o contrato vigente antes/depois e emitiram `NOTIFY pgrst`. O serviço
REST precisou de um restart controlado para descartar o schema cache antigo.
Não usar `CASCADE` nem executar com root por SSH.

## Pré-condições

1. Obter confirmação explícita para remover os quatro overloads legados.
2. Abrir uma segunda sessão SSH independente para o smoke pós-apply.
3. Capturar definição, ACL, owner e OID dos oito alvos (quatro legados e quatro
   vigentes) imediatamente antes da alteração. Guardar o snapshot fora do
   repositório e não incluir chaves/tokens.
4. Confirmar que o container retornado pelo comando abaixo é o banco de
   produção esperado.

```bash
DB_CONTAINER="$(ssh -o BatchMode=yes ceres-prod \
  'sudo -n docker ps --filter name=supabase_supabase_db --format "{{.Names}}" | head -1')"
test -n "$DB_CONTAINER"
printf '%s\n' "$DB_CONTAINER"
```

Snapshot read-only (salvar a saída com controle de acesso local):

```bash
ssh -o BatchMode=yes ceres-prod \
  "sudo -n docker exec $DB_CONTAINER psql -qAt -U postgres -d postgres -F '|' -c \"SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),p.prosecdef,COALESCE(array_to_string(p.proacl,','),'(default)'),pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('rpc_desempenho_vendas_bi','rpc_acoes_pedidos_ganhos','rpc_acoes_negocios_perdidos','rpc_evolucao_ganhos_perdidos_12m') ORDER BY p.proname,p.oid;\""
```

## Aplicação (executada)

Aplicar cada arquivo com `ON_ERROR_STOP` e `--single-transaction`; se qualquer
preflight, `RESTRICT` ou pós-validação falhar, a respectiva transação aborta.

```bash
for migration in \
  supabase/migrations/20260922_remove_ambiguous_rpc_desempenho_vendas_overload.sql \
  supabase/migrations/20260922_remove_ambiguous_acoes_gpo_overloads.sql; do
  ssh -o BatchMode=yes ceres-prod \
    "sudo -n docker exec -i $DB_CONTAINER psql -X -v ON_ERROR_STOP=1 -1 -U postgres -d postgres" \
    < "$migration"
done
```

Não executar a segunda migration se a primeira falhar. O rollback de emergência
é manual: restaurar a definição/ACL do snapshot com `CREATE OR REPLACE`/`GRANT`
em uma janela aprovada e emitir `NOTIFY pgrst, 'reload schema'`. Recriar o
overload legado reintroduz PGRST203, portanto deve ser usado somente para
restaurar serviço quebrado enquanto o cliente/versão canônica é corrigido.

## Verificação SQL pós-apply (PASS)

Executar numa sessão nova. Os quatro `to_regprocedure` legados devem retornar
`NULL`; os quatro contratos vigentes devem continuar presentes.

```sql
SELECT
  to_regprocedure('public.rpc_desempenho_vendas_bi(date,date,integer,text,text,text,text,text,text,text)') AS desempenho_legacy,
  to_regprocedure('public.rpc_desempenho_vendas_bi(date,date,integer,text,text,text,text,text,text,text,text[])') AS desempenho_current,
  to_regprocedure('public.rpc_acoes_pedidos_ganhos(date,date,text,text,integer,integer)') AS pedidos_legacy,
  to_regprocedure('public.rpc_acoes_pedidos_ganhos(date,date,text,text,integer,integer,text[])') AS pedidos_current,
  to_regprocedure('public.rpc_acoes_negocios_perdidos(date,date,text,text,integer,integer)') AS perdidos_legacy,
  to_regprocedure('public.rpc_acoes_negocios_perdidos(date,date,text,text,integer,integer,text[])') AS perdidos_current,
  to_regprocedure('public.rpc_evolucao_ganhos_perdidos_12m(text)') AS gpo_legacy,
  to_regprocedure('public.rpc_evolucao_ganhos_perdidos_12m(text,date,date)') AS gpo_current;

SELECT json_typeof(public.rpc_desempenho_vendas_bi(
  p_from => DATE '2026-09-01', p_to => DATE '2026-09-02', p_funis => NULL
));

SELECT json_typeof(public.rpc_acoes_pedidos_ganhos(
  DATE '2026-09-01', DATE '2026-09-02', NULL, NULL, 50, 0, NULL::text[]
));

SELECT json_typeof(public.rpc_acoes_negocios_perdidos(
  DATE '2026-09-01', DATE '2026-09-02', NULL, NULL, 50, 0, NULL::text[]
));

SELECT count(*) FROM public.rpc_evolucao_ganhos_perdidos_12m(NULL, NULL, NULL);
```

## Smoke HTTP (PASS)

Com a chave pública já configurada no ambiente local, confirmar HTTP 200 para
os corpos que incluem os discriminadores (`p_funis: null` e período do GPO) e
que o corpo antigo sem discriminador não retorna mais HTTP 300/PGRST203. Não
imprimir tokens nos logs.

Resultado observado: Desempenho, Ações ganhos, Ações perdidos e GPO retornaram
HTTP 200 sem o discriminador novo; as versões com `p_funis` também retornaram
HTTP 200. Latências da primeira rodada: aproximadamente 1,55 s, 1,56 s, 3,18 s
e 1,22 s, respectivamente. O container PostgreSQL permaneceu saudável e o
serviço REST convergiu em 1/1.

## Publicação web e smoke pós-deploy (PASS)

A imagem web foi publicada na VPS pela stack `ceresbi` com a tag imutável
`ceresbi:4c38c89b6b93` (commit `4c38c89b6b93bcb270246ef3bf147b1242565055`).
O serviço web e o AI convergiram em `1/1`, o repositório remoto e o checkout da
VPS apontam para o mesmo SHA, `/` respondeu HTTP 200 e `/api/ai/health`
respondeu HTTP 200. O smoke RPC autenticado com a chave pública retornou 200
para Desempenho, Ações ganhos, Ações perdidos e GPO; para o GPO o contrato
vigente usa `p_vendedor`, não `p_tipo`.

O smoke visual autenticado em navegador das rotas `/bi/acoes` e
`/bi/desempenho` ainda precisa ser executado com uma sessão de usuário; a
validação CLI não possui credenciais de usuário e não deve inventar esse PASS.

## Critério de saída

- quatro overloads legados ausentes e quatro vigentes preservados — PASS;
- SQL smoke retorna JSON/linhas, sem `PGRST203` — PASS;
- HTTP/PostgREST com schema recarregado retorna 200 — PASS;
- `/bi/acoes` e `/bi/desempenho` renderizam sem shell preso — pendente apenas
  do smoke visual autenticado acima;
- `pg_stat_statements`/`EXPLAIN` são recapturados depois, sem declarar ainda que
  a latência multi-ano foi otimizada.
