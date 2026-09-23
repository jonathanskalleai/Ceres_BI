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
de criação, quatro funções com `prosecdef=true` e `can_execute=true`. O serviço
não precisa de `SELECT` direto nas tabelas para chamar RPCs `SECURITY DEFINER`;
se uma RPC exigir isso, trate como falha de desenho e não conceda leitura ampla
por conveniência.

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
