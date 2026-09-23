# Role dedicada e canário autenticado da API BI

Este procedimento prepara o WP1 sem reutilizar o usuário `postgres` nem
`supabase_read_only_user`. Ele não deve ser executado pelo frontend, pela
aplicação ou automaticamente em uma migration: criação de login e definição de
senha são operações de infraestrutura e exigem um administrador do cluster.

## Por que uma role nova

O banco atual é o PostgreSQL interno do Supabase. A role legada
`supabase_read_only_user` possui `pg_read_all_data`, `rolbypassrls=true` e não
possui `EXECUTE` nas quatro RPCs do canário. Ela é ampla demais para o serviço e
não é a credencial correta para `BI_DATABASE_URL`.

Use uma role exclusiva, sem privilégios de escrita:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceres_bi_api') THEN
    CREATE ROLE ceres_bi_api
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION;
  END IF;
END
$$;

ALTER ROLE ceres_bi_api SET default_transaction_read_only = 'on';
ALTER ROLE ceres_bi_api SET statement_timeout = '35000';
ALTER ROLE ceres_bi_api SET lock_timeout = '2000';
GRANT CONNECT ON DATABASE postgres TO ceres_bi_api;
GRANT USAGE ON SCHEMA public TO ceres_bi_api;
-- A API consulta somente estes campos para autorizar o JWT no servidor.
GRANT SELECT (id, role, is_active) ON public.profiles TO ceres_bi_api;
GRANT SELECT (user_id, module_id) ON public.user_permissions TO ceres_bi_api;
```

Defina a senha fora do repositório, usando o mecanismo de segredo da VPS. Não
coloque senha em migration, `.env` versionado, log, shell history ou neste
runbook. O DSN do serviço deve apontar para `ceres_bi_api`, nunca para
`postgres`.

## Grants mínimos do canário

Conceda somente as assinaturas que a API usa hoje. Os grants são separados por
assinatura para não liberar overloads adicionais:

```sql
GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi_periodo(date,date,text,text,text)
  TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_detalhe(date,date,text,text,text,integer,integer,text)
  TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo(date,date,text,text)
  TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_mapa_oportunidades(text,text,date,date)
  TO ceres_bi_api;
```

### Grants do catálogo completo (WP5)

Quando o canário de Ações passar, a mesma role pode receber as assinaturas
read-only das demais dashboards. A lista abaixo foi conferida contra as
assinaturas presentes no PostgreSQL de produção em 2026-09-23. Execute apenas
as linhas necessárias para a release; não use `GRANT EXECUTE ON ALL FUNCTIONS`.

```sql
GRANT EXECUTE ON FUNCTION public.rpc_negocios_bi(date,date,text[],text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_resultados_negocios_bi(date,date,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_negocios_bi_expandido(date,date,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_pedidos_bi(date,date,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_pedidos_pendentes_esteira(date,date,integer,text,text,text[]) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_servicos_bi(date,date,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_admin_bi(text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_inteligencia_esforco_bi(date,date,text[]) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_parque_renovacao_bi(integer) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_operacional_bi() TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_produtos_bi() TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_desempenho_vendas_bi(date,date,integer,text,text,text,text,text,text,text,text[]) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi(date,date,text,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi_periodo(date,date,text,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_detalhe(date,date,text,text,text,integer,integer,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_visitas_mensal(date,date,text,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_evolucao_mensal_ano_corrente(text,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_clientes_risco(text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_clientes_criticos_bi(text,text,integer,integer) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date,date,text,text,integer,integer) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao(date,date,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo(date,date,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date,date,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_gestao_listas(text,date,date,text,text,integer,integer,text,integer,integer) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_desperdicio_ano_corrente(text,text,integer,integer,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_mapa_oportunidades(text,text,date,date) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_pedidos_ganhos(date,date,text,text,integer,integer,text[]) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_negocios_perdidos(date,date,text,text,integer,integer,text[]) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_termometro_fechamento(date,date,text,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_etl_status() TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_etl_log(text,integer) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_kpis_comercial(date,date,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_evolucao_mensal(date,date,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_evolucao_ganhos_perdidos_12m(text,date,date) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_evolucao_negocios_12m(text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_evolucao_tipos_acao_12m(text,integer) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_ranking_vendedores(date,date,integer) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_ranking_vendedores_v2(date,date,integer) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_ranking_regioes(date,date,integer) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_clientes_por_vendedor(text,date,date) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_registros_recentes(date,date,text,text,integer) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_listas_filtros(date,date) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_consultor_negocios_pipeline(text,integer) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_consultores_resumo_acoes(date,date,text,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_equipe_desempenho_mensal(integer,text,text) TO ceres_bi_api;
GRANT EXECUTE ON FUNCTION public.rpc_equipe_desempenho_mensal_v2(integer,text,text) TO ceres_bi_api;
```

Os grants são um checklist de infraestrutura, não uma autorização para
executar agora. Antes de aplicá-los, confirme novamente `pg_proc`,
`prosecdef`, owner, `search_path` seguro e a paridade de cada dashboard.

Não revogue `PUBLIC`, `anon` ou `authenticated` neste passo: o frontend legado
ainda está ativo e essa alteração seria uma mudança funcional fora do canário.
Antes de qualquer revogação, faça uma mudança separada com paridade e plano de
rollback.

As quatro RPCs atuais são `SECURITY DEFINER`. Antes de conceder acesso,
confirme que cada uma tem `prosecdef=true`, owner esperado e `search_path`
seguro. Se alguma função depender de `search_path` mutável ou de uma função
auxiliar sem proteção, pare o canário e corrija a função em uma migration
separada.

## Validação read-only antes do deploy

Execute como administrador, sem mostrar senha ou DSN:

```sql
SELECT r.rolname, r.rolsuper, r.rolinherit, r.rolbypassrls,
       r.rolcreaterole, r.rolcreatedb, r.rolcanlogin
FROM pg_roles r
WHERE r.rolname IN ('ceres_bi_api', 'supabase_read_only_user');

SELECT p.oid::regprocedure AS function_name,
       p.prosecdef,
       pg_get_userbyid(p.proowner) AS owner,
       has_function_privilege(
         'ceres_bi_api', p.oid, 'EXECUTE'
       ) AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.oid IN (
    'public.rpc_acoes_bi_periodo(date,date,text,text,text)'::regprocedure,
    'public.rpc_acoes_detalhe(date,date,text,text,text,integer,integer,text)'::regprocedure,
    'public.rpc_acoes_funil_gestao_periodo(date,date,text,text)'::regprocedure,
    'public.rpc_acoes_mapa_oportunidades(text,text,date,date)'::regprocedure
  )
ORDER BY 1;

SELECT has_schema_privilege('ceres_bi_api', 'public', 'USAGE') AS public_usage,
       has_table_privilege('ceres_bi_api', 'public.profiles', 'SELECT') AS profiles_select,
       has_table_privilege('ceres_bi_api', 'mirror.crm_acoes', 'SELECT') AS mirror_select;
```

O resultado esperado é `rolsuper=false`, `rolbypassrls=false`, sem privilégios
de criação, quatro funções com `prosecdef=true` e `can_execute=true`. As RPCs
`SECURITY DEFINER` continuam sem `SELECT` direto nas tabelas analíticas; as duas
concessões de colunas acima existem somente para a autorização do JWT. Se uma
RPC exigir leitura adicional, trate como falha de desenho e não conceda leitura
ampla por conveniência.

## Canário

1. Mantenha `VITE_BI_API_ENABLED=false` para todos os usuários.
2. Configure `BI_DATABASE_URL` apenas no serviço BI, usando a role nova e o
   segredo fora do repositório.
3. Faça deploy de uma única instância/rota, depois valide `/health` e o boot.
4. Com um JWT de usuário que tenha a permissão BI Ações, chame uma vez cada
   endpoint `/api/bi/acoes/{core,detalhe,funil,mapa}` para um mês e para o ano.
5. Confirme envelope `status`, `requestId`, `metrics`, dados não vazios quando
   a consulta legada tem dados e quatro eventos `bi_query` sem token, filtro,
   SQL ou PII.
6. Compare os quatro resultados com as RPCs legadas e capture query/api/payload
   no baseline. Sem essa paridade, não habilite a flag.

Teste também um usuário sem `user_permissions.bi.acoes`: deve receber 403/401,
sem executar a RPC. Teste filtros inválidos e strings acima do limite: devem
retornar 422. Não repita tentativas de root/senha no SSH; isso aciona Fail2ban.

## Rollback

O rollback normal é reversível e não destrutivo:

1. desligar a feature flag e retirar a rota do canário;
2. parar o serviço BI ou restaurar a imagem anterior;
3. revogar apenas os quatro `EXECUTE` da role `ceres_bi_api`;
4. `ALTER ROLE ceres_bi_api NOLOGIN` enquanto a investigação estiver aberta.

Não execute `DROP ROLE` automaticamente. Remoção definitiva exige confirmação
explícita, verificação de dependências e backup do registro de auditoria.

## Critério de saída do WP1

O WP1 só passa quando a role dedicada, ACL das quatro funções, autorização de
usuário, resposta canônica, paridade mensal/anual e benchmark autenticado forem
comprovados. Até lá, o gateway permanece com flag desligada e nenhuma alteração
de produção é considerada concluída.
