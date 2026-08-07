# Codex Review Pack v4 — /bi/acoes Recovery + Plano Pós-Deploy

## Contexto: estado atual após múltiplas tentativas

O pipeline do /bi/acoes v10 passou por 2 auditorias Codex + Phase 0 + 10 migrations aplicadas + 6 stories frontend. Após o merge em `b0ed013`, identificamos 3 bugs pós-deploy (TypeError, contratos snake/camel, drill-down sem from/to). Codex #3 (auditoria v3) rejeitou plano v3 (DASH mascara bugs). Decidimos pelo caminho A (correção real dos contratos).

O **PR 1 (PR 1 / contratos)** foi parcialmente implementado:
- ✅ Frontend deployado (commit `7fc1148`)
- ✅ `rpc_acoes_pedidos_ganhos` em prod retorna `pedidoCodigo`, `valorPedido` corretamente
- ✅ `rpc_acoes_negocios_perdidos` em prod retorna `valorPerdido`, `dataFechamento` corretamente
- ❌ `rpc_acoes_em_andamento` **FOI DROPPADA em prod via SSH e NÃO FOI RECRIADA** — count=0 confirmado

## O que precisa ser avaliado

### Pergunta 1 — Caminho A ou B?

**Caminho A: ROLLBACK**
- Reverter o commit `7fc1148` (PR 1 frontend)
- Frontend volta ao estado pré-fix
- "Pedidos Aprovados" volta a mostrar 0 (sem from/to)
- "Perdido" volta a dar TypeError (valorNegociado undefined)
- "Em Andamento" volta a funcionar via RPC antiga (snake_case)
- Mantém a função antiga em prod (sem DROP)
- **Risco:** reverter o fix do from/to também (Story 4-A/4-B/5-A) — bug "Pedidos 0" volta

**Caminho B: CONTINUAR + APLICAR MIGRATION**
- Corrigir a migration `20260803_fix_rpc_acoes_em_andamento_aliases.sql` (fix do `END$fn$`)
- Aplicar via SSH em 2 passos: (a) DROP FUNCTION IF EXISTS; (b) CREATE OR REPLACE
- Validar com dump do JSON real
- Commit + push + deploy
- **Risco:** se a migration tem erro de lógica, função continua quebrada

### Pergunta 2 — A migration `20260803_fix_rpc_acoes_em_andamento_aliases.sql` está correta?

Conteúdo da migration (Linhas críticas):

```sql
CREATE OR REPLACE FUNCTION public.rpc_acoes_em_andamento(
  p_from date, p_to date, p_vendedor text DEFAULT NULL, p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 50, p_offset int DEFAULT 0
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $fn$
DECLARE
  v_limit  int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 2000);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN (
    WITH
      acoes_periodo AS (
        SELECT DISTINCT a.ngo_nronegocio, a.aco_vendedor, a.cli_idcliente
        FROM mirror.crm_acoes a
        WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
          AND a.aco_dthconclusao IS NOT NULL
          AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      ),
      negocios_do_periodo AS (
        SELECT DISTINCT ON (ap.ngo_nronegocio)
          ap.ngo_nronegocio AS negocio_numero, ap.cli_idcliente, MAX(ap.aco_vendedor) AS ultimo_vendedor
        FROM acoes_periodo ap
        WHERE ap.ngo_nronegocio IS NOT NULL AND ap.ngo_nronegocio <> ''
        GROUP BY ap.ngo_nronegocio, ap.cli_idcliente
      ),
      filtered_dedup AS (SELECT ndp.negocio_numero, ndp.cli_idcliente, ndp.ultimo_vendedor FROM negocios_do_periodo ndp),
      negocios_base AS (
        SELECT DISTINCT ON (n.ngo_numero)
          n.ngo_numero, n.ngo_conclusao, n.ngo_funil, n.ngo_etapa, n.ngo_vlrtotalnegociado,
          n.ngo_vendedores, n.cli_idcliente
        FROM mirror.crm_negocios n WHERE n.ngo_numero IS NOT NULL
        ORDER BY n.ngo_numero, n.ngo_dataatualizacao DESC NULLS LAST, n.dthregistro DESC NULLS LAST
      ),
      negocios_canonicos AS (
        SELECT b.ngo_numero, b.ngo_conclusao, b.ngo_funil, b.ngo_etapa,
          b.ngo_vlrtotalnegociado, b.ngo_vendedores, b.cli_idcliente,
          NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
          mirror.fn_cli_cidade(b.cli_idcliente) AS cidade_negocio
        FROM negocios_base b LEFT JOIN mirror.usuarios u ON u.usr_codusuario = NULLIF(b.ngo_vendedores, '')
      ),
      em_andamento_canonicos AS (
        SELECT DISTINCT ON (nc.ngo_numero)
          nc.ngo_numero AS negocio_numero, nc.ngo_etapa AS etapa, nc.ngo_vlrtotalnegociado AS valor_negociado,
          nc.ngo_conclusao AS conclusao, nc.ngo_funil AS funil, nc.cli_idcliente,
          nc.consultor_negocio, nc.cidade_negocio
        FROM filtered_dedup fd JOIN negocios_canonicos nc ON nc.ngo_numero = fd.negocio_numero
        WHERE nc.ngo_conclusao = 'Em Andamento' AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
          AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
        ORDER BY nc.ngo_numero
      )
    SELECT json_build_object(
      'rows', COALESCE(
        (SELECT json_agg(row_to_json(sub) ORDER BY sub."diasParado" DESC, sub."negocioNumero" ASC)
         FROM (
           SELECT ec.negocio_numero AS "negocioNumero",
             COALESCE((SELECT cc.cli_nome FROM mirror.crm_carteira_clientes cc
                       WHERE cc.cli_idcliente = ec.cli_idcliente ORDER BY cc.cli_idcliente LIMIT 1),
                      '<sem cadastro>') AS cliente,
             ec.cidade_negocio AS cidade, ec.consultor_negocio AS consultor, ec.etapa AS etapa,
             ec.valor_negociado AS "valor",
             aco.tipo_contato AS "ultimaAcao", aco.ultima_acao AS "dataUltimaAcao",
             (CURRENT_DATE - aco.ultima_acao::date)::int AS "diasParado"
           FROM em_andamento_canonicos ec
           JOIN LATERAL (
             SELECT a.aco_dthconclusao AS ultima_acao, a.aco_tipocontato AS tipo_contato
             FROM mirror.crm_acoes a
             WHERE a.ngo_nronegocio = ec.negocio_numero AND a.aco_dthconclusao IS NOT NULL
             ORDER BY a.aco_dthconclusao DESC LIMIT 1
           ) aco ON TRUE
           WHERE (p_vendedor IS NULL OR ec.consultor_negocio = p_vendedor)
           ORDER BY "diasParado" DESC, "negocioNumero" ASC LIMIT v_limit OFFSET v_offset
         ) sub),
        '[]'::json),
      'total', (SELECT COUNT(*) FROM em_andamento_canonicos ec
                 WHERE (p_vendedor IS NULL OR ec.consultor_negocio = p_vendedor))
    )
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) TO authenticated, service_role;
```

### Pergunta 3 — Riscos do estado atual

1. **Frontend deployed com chamadas quebradas para em_andamento:** usuário que clicar no chip "Em Andamento" recebe erro "function does not exist"
2. **Função RPC em_andamento DROPPADA mas frontend ainda a chama** — inconsistência de produção
3. **Bundle do frontend tem as referências antigas** (`negocioNumero`, `valor`, `ultimaAcao`, `dataUltimaAcao`, `diasParado` em camelCase) mas se a função for recriada com aliases snake_case, o frontend quebra de novo

### Pergunta 4 — Smoke test sugerido (quando caminho B for aprovado)

```bash
# 1. DROP separado (transacional)
docker exec -i <container> psql -U postgres -d postgres -c "DROP FUNCTION IF EXISTS public.rpc_acoes_em_andamento(date, date, text, text, int, int);"

# 2. CREATE OR REPLACE (transacional, psql -1)
docker exec -i <container> psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -1 -f <migration>

# 3. Validar aliases (camelCase no JSON retornado)
docker exec -i <container> psql -U postgres -d postgres -tAc "SELECT (rpc_acoes_em_andamento('2026-07-01','2026-07-31',NULL,NULL,1,0)::text);"
# Esperado: {"rows":[{"negocioNumero":"...", "cliente":"...", ..., "diasParado":N}], "total":112}

# 4. Validar total
docker exec -i <container> psql -U postgres -d postgres -tAc "SELECT (rpc_acoes_em_andamento('2026-07-01','2026-07-31',NULL,NULL,50,0)->>'total')::int;"
# Esperado: 112

# 5. ACL
docker exec -i <container> psql -U postgres -d postgres -tAc "SELECT count(*) FROM information_schema.routine_privileges WHERE routine_name='rpc_acoes_em_andamento' AND grantee IN ('PUBLIC','anon');"
# Esperado: 0

docker exec -i <container> psql -U postgres -d postgres -tAc "SELECT count(*) FROM information_schema.routine_privileges WHERE routine_name='rpc_acoes_em_andamento' AND grantee='authenticated';"
# Esperado: >= 1
```

### Pergunta 5 — Outras decisões pendentes do pipeline v3 que ficaram em aberto

Do Codex review #3 (4ª auditoria):
- **Bug 2 (Esforço x Retorno mostra 8 linhas em vez de 20):** investigar se é intencional ou bug. Pelo `docs/features/acoes-bi.md` §Padroes, parece ser **intencional** (8 + "ver mais").
- **Bug 4 (Recap / memória apareceu na tela):** usuário reportou mas não há componente "Recap" no código. Hipótese mais provável: autofill do Chrome no form de login (persistSession: true + localStorage).

### Pergunta 6 — Recomendação final

Qual caminho você recomenda?

**Opção A** (rollback + estabilidade imediata):
- `git revert 7fc1148`
- Frontend volta a funcionar (Em Andamento OK, mas Ganho/Perdido quebrados)
- Fix dos contratos vira ciclo futuro

**Opção B** (terminar PR 1 corretamente):
- Corrigir + aplicar migration corrigida com calma
- Validar smoke
- Continuar com frontend já em prod

**Opção C** (rollback cirúrgico + hotfix mínimo):
- `git revert 7fc1148`
- Fazer hotfix mínimo SÓ para o bug do from/to (Story 4-A/4-B/5-A)
- Deixar contratos alinhados para ciclo futuro

## Estado do git

```
HEAD = 7fc1148 (force-pushed depois do merge b0ed013)
main = 7fc1148 (PR 1 frontend deployed, sem commit de migration ainda)
Último commit: fix(bi/acoes): alinhar contratos RPC<->service<->tabela (PR 1 / contratos)
```

Migration `20260803_fix_rpc_acoes_em_andamento_aliases.sql` está **no repo local** mas NÃO commitada (working tree dirty).

## Histórico de tentativas no VPS

1. **Tentativa 1 (CREATE OR REPLACE):** função ficou com aliases novos mas sem CTEs (estado quebrado)
2. **Tentativa 2 (DROP + CREATE):** falhou por conflito psql -1 + SAVEPOINT
3. **Tentativa 3 (via base64):** `$fn$` virou `$` por causa de escape do expect
4. **Tentativa 4 (DROP direto):** SUCESSO — função agora tem count=0 em prod

## O que já validamos

- `rpc_acoes_pedidos_ganhos('2026-07-01','2026-07-31',NULL,NULL,1,0)::text` em prod retorna:
  `{"rows":[{"pedidoCodigo":"2607310949149298972","negocioNumero":"2607310913128972","valorPedido":168000.00,"dataAprovacao":"2026-07-31T13:54:28.977","consultor":"GERIEL DOS SANTOS","cidade":"Vitorino","cliente":"WASHINGTON LUIZ RAMOS FERRO"}], "total":26}`

- `rpc_acoes_negocios_perdidos('2026-07-01','2026-07-31',NULL,NULL,1,0)::text` em prod retorna:
  `{"rows":[{"negocioNumero":"26072809080525930","dataFechamento":"2026-07-28T10:31:35","valorPerdido":130000.00,"consultor":"LUIZ CARLOS CUNICO","cidade":"Bom Jesus","cliente":"VALDOMIRO CAMBRUSSI"}], "total":7}`

- `rpc_acoes_em_andamento(...)` em prod: **function does not exist**

## Veredito final pedido

Você recomenda **A, B ou C**? Tem alguma alternativa que eu não enxerguei? Algum risco de segurança em rollback ou continuação?
