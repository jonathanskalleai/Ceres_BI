# SEC-REVIEW-v3 — Errata + Plano de GRANT Corrigido: /bi/acoes v10

**Agente:** @security (Cipher)
**Data:** 2026-08-03
**Baseado em:** SEC-REVIEW-AcoesV10.md (v1) + Codex 2a auditoria (CRIT 1 + CRIT 2)
**Ground truth:** `.aivoux/state/REL-ESTADO-BANCO.md` + migrations + codigo fonte frontend

---

## Errata do v1

### O Erro

O SEC-REVIEW-AcoesV10.md (v1) declarou na Parte 2, secoes 128-133 e 143:

> "REVOKE FROM PUBLIC e desnecessario quando o GRANT ja especifica roles."

Essa afirmacao esta **incorreta**. O Codex CRIT 2 da 2a auditoria identificou o erro com precisao.

### Por Que GRANT Explicito NAO E Whitelist no Postgres

**Mecanismo do ACL padrao do Postgres:**

Quando uma funcao e criada no schema `public`, o Postgres automaticamente adiciona
`GRANT EXECUTE TO PUBLIC` na ACL da funcao. Isso significa que TODO role do banco
(automaticamente) herda permissao de execucao, incluindo `anon`.

```
-- Ao criar: CREATE FUNCTION public.rpc_xxx(...);
-- Postgres internally does:
-- GRANT USAGE ON SCHEMA public TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.rpc_xxx(...) TO PUBLIC;
```

**O padrao historico das migrations e redundante com PUBLIC:**

```sql
-- Migration 20260727_rpc_acoes_bi_v5.sql linha 417:
GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi(...) TO anon, authenticated, service_role;
```

Este GRANT adiciona `anon`, `authenticated` e `service_role` a lista de roles com
EXECUTE. Mas `PUBLIC` JA tinha EXECUTE antes. O `anon` herda de PUBLIC, nao do GRANT.
O GRANT e literalmente redundante com a permissao ja existente.

**Simulacao do teste que o v1 deveria ter previsto:**

```sql
-- Apos aplicar uma migration que sรณ faz:
CREATE FUNCTION public.rpc_xxx(...) ... SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.rpc_xxx(...) TO authenticated, service_role;

-- Query de verificacao:
SELECT has_function_privilege('anon', 'rpc_xxx(...)', 'EXECUTE');
-- RETORNA: true (mesmo sem anon no GRANT!)

SELECT has_function_privilege('public', 'rpc_xxx(...)', 'EXECUTE');
-- RETORNA: true (herdado do ACL padrao do schema public)
```

**Evidencia do REL-ESTADO-BANCO §4:**

A query de ground truth no banco vivo confirmou exatamente isso:

| Funcao                       | anon   | PUBLIC | authenticated | service_role |
|------------------------------|--------|--------|--------------|--------------|
| rpc_acoes_bi                 | SIM    | SIM    | SIM          | SIM          |
| rpc_acoes_funil_gestao       | SIM    | SIM    | SIM          | SIM          |
| rpc_acoes_marca_oportunidades| SIM    | SIM    | SIM          | SIM          |
| rpc_acoes_detalhe            | SIM    | NAO    | SIM          | SIM          |

Para `rpc_acoes_detalhe`, o `PUBLIC` nao tem EXECUTE (provavelmente ja houve um REVOKE
em migacao anterior ou o owner e diferente), mas `anon` ainda tem. Isso acontece
porque `anon` herda de PUBLIC mesmo quando PUBLIC e revogado — o `anon` precisa ser
revogado explicitamente.

### Consequencia do Erro do v1

Se as 3 novas RPCs forem deployadas com apenas:
```sql
GRANT EXECUTE ON FUNCTION public.rpc_acoes_xxx(...) TO authenticated, service_role;
-- SEM REVOKE FROM PUBLIC, SEM REVOKE FROM anon
```

Entao `anon` CONTINUA com EXECUTE via heranca de `PUBLIC`. Qualquer pessoa pode chamar
a RPC diretamente via PostgREST sem JWT, e como a funcao e `SECURITY DEFINER` executando
como `postgres` (superuser), ela le TODO o CRM.

### Padrao Correto

```sql
REVOKE EXECUTE ON FUNCTION public.rpc_xxx(...)
  FROM PUBLIC;         -- ESSENCIAL: remove heranca automatica do schema
REVOKE EXECUTE ON FUNCTION public.rpc_xxx(...)
  FROM anon;           -- defesa em profundidade: anon nao herda de PUBLIC se PUBLIC for re-concedido
GRANT EXECUTE ON FUNCTION public.rpc_xxx(...)
  TO authenticated, service_role;  -- unicos com acesso
```

---

## Recomendacao GRANT Revisado

### Para as 7 RPCs (3 novas + 4 existentes)

A decisao original do usuario foi "revogar anon das 3 novas". O Codex CRIT 1 da
2a auditoria指出 que as 4 RPCs existentes tambem estao abertas e precisam de revogacao.

**RECOMENDACAO: Revogar das 7.**

Template de migration corretiva:

```sql
-- =========================================================================
-- CORRETIVA DE SEGURANCA: 7 RPCs acoes BI
-- Aplica REVOKE FROM PUBLIC + REVOKE FROM anon em todas as 7 funcoes
-- que servem /bi/acoes, seguido de GRANT limpo para authenticated+service_role.
-- Cada linha cobre uma funcao; executado como superuser (postgres).
-- =========================================================================

-- rpc_acoes_bi (existente v9 — CRIT 1 Codex)
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_bi(date, date, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_bi(date, date, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi(date, date, text, text, text) TO authenticated, service_role;

-- rpc_acoes_funil_gestao (existente v6 — CRIT 1 Codex)
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao(date, date, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao(date, date, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao(date, date, text, text) TO authenticated, service_role;

-- rpc_acoes_mapa_oportunidades (existente — CRIT 1 Codex)
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_mapa_oportunidades(date, date, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_mapa_oportunidades(date, date, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_mapa_oportunidades(date, date, text, text) TO authenticated, service_role;

-- rpc_acoes_detalhe (existente — CRIT 1 Codex, PUBLIC ja revogado mas anon permanece)
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_detalhe(date, date, text, text, text, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_detalhe(date, date, text, text, text, text, integer, integer) TO authenticated, service_role;

-- rpc_acoes_pedidos_ganhos (nova)
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_pedidos_ganhos(date, date, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_pedidos_ganhos(date, date, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_pedidos_ganhos(date, date, text, text) TO authenticated, service_role;

-- rpc_acoes_negocios_perdidos (nova)
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_negocios_perdidos(date, date, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_negocios_perdidos(date, date, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_negocios_perdidos(date, date, text, text) TO authenticated, service_role;

-- rpc_acoes_em_andamento (nova)
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
```

**Nota de execucao:** Aplicar via docker exec conforme `.aivoux/state/REL-ESTADO-BANCO.md §9`.

### Logica das Revogacoes

| Revogar de | Por que |
|------------|---------|
| `PUBLIC`   | Remove heranca automatica do schema `public` — SEMPRE necessario para whitelist |
| `anon`     | Defesa em profundidade: `anon` pode ter ACL propria mesmo se PUBLIC for re-concedido |

| Conceder a  | Por que |
|-------------|---------|
| `authenticated` | Frontend BI autentica com JWT (REL-ESTADO-BANCO §1 + v1 Parte 1 confirmada) |
| `service_role`  | ETL/admin tools em background — role interno padrao Supabase |

**Nao incluir:** `supabase_admin` (superuser interno, nao precisa de GRANT explicito).

### Alternativa: Risco Aceito nas 4 Existentes

Se o usuario quiser preservar as 4 existentes sem revogacao:

1. Documentar como risco aceito explicitamente.
2. Adicionar monitoramento: Logflare query para detectar chamadas as 4 RPCs via PostgREST
   sem JWT ou com role anon.
3. Trade-off: monitoramento nao substitui REVOKE — e defesa superficial.

**Avaliacao de risco:** CRITICO. Sao 4 de 5 RPCs do /bi/acoes abertas. O frontend inteiro
autentica (v1 confirmou). O risco de quebra e ZERO. A exposicao e TODO o CRM.
A recomendacao permanece: **revogar das 7**.

---

## Blast Adjacente das 4 RPCs Existentes

### Consumidores Identificados

| RPC | Hook/Servico | Cliente | Impacto do REVOKE |
|-----|-------------|---------|-------------------|
| `rpc_acoes_bi` | `useAcoesBIRpc.ts` -> `fetchAcoesBI()` em `biRpcService.ts:170-191` | `supabase` (autenticado) | Seguro |
| `rpc_acoes_funil_gestao` | `useAcoesFunilRpc.ts` -> `fetchAcoesFunilGestao()` em `acoesGestaoService.ts:57-85` | `supabase` (autenticado) | Seguro |
| `rpc_acoes_detalhe` | `useAcoesDetalheRpc.ts` -> `fetchAcoesDetalhe()` em `biRpcService.ts:201-231` | `supabase` (autenticado) | Seguro |
| `rpc_acoes_mapa_oportunidades` | `useAcoesMapaRpc.ts` -> `fetchAcoesMapaOportunidades()` em `acoesGestaoService.ts:156-179` | `supabase` (autenticado) | Seguro |

### Clientes Administrativos

`adminClient.ts` define `supabaseAdmin` (service_role). Verificado: `adminBIService.ts`
NAO usa `supabaseAdmin` para as 4 RPCs. Ele chama `supabase.schema("mirror").from("crm_carteira_clientes")`
(tabela via PostgREST), nao via RPC. O `service_role` nao e afetado pelo REVOKE de `anon`.

### Screens que usam as 4 RPCs

Todas servem exclusivamente `/bi/acoes` (BI Acoes). Outras telas BI (Negocios,
Pedidos, Servicos, Admin) usam `rpc_negocios_bi`, `rpc_pedidos_bi`, etc. — funcoes
diferentes, fora do escopo desta revogacao.

### Conclusao do Blast

**Risco de quebra: ZERO.** Todos os consumidores usam o cliente autenticado.
Nenhum usa `anon` ou `supabaseAdmin`. A revogacao e segura.

---

## Story 3-A: Ordenacao Server-Side

A Opcao D do @ux exige ordenacao `NULL primeiro, depois visitasPorOportunidade DESC`
que `rpc_acoes_gestao_listas` atual nao produz.

**Pergunta:** A migration `20260803_rpc_acoes_gestao_listas_v2_ordenacao_desperdicio.sql`
planejada pelo @architect-v3 e necessaria?

**Resposta: SIM, e necessaria.** A ordenacao NULLs-First + DESC e um requisito
funcional da Opcao D. Sem a nova versao da RPC, a lista nao respeita a ordenacao
desejada pelo design.

**Implicacoes de seguranca: NENHUMA.** A mudanca e puramente de ordenacao de
resultados ja existentes. A mesma revogacao de grants que se aplica as 3 novas
RPCs se aplica a esta (caso o AUTHORIZATION mudar). A funcao continua `STABLE
SECURITY DEFINER` — o mesmo nivel de acesso que as demais 6 RPCs.

**Arquivos impactados:** Nenhum alem da migration. O frontend ja recebe a lista
ordenada do servidor — se a ordenacao mudar, o componente simplesmente renderiza
a ordem nova.

---

## Veredicto Final

**Verdict: GO**

O plano v10 pode seguir com as seguintes condicoes obrigatorias:

1. **Migration de revogacao para as 7 RPCs** — template na secao 2 acima.
   Esta e a alteracao mais critica do plano. Sem ela, as 3 novas RPCs nascem
   tao abertas quanto as 4 existentes.

2. **Migrations das 3 novas RPCs** — ajustar para usar o template de revogacao
   antes do GRANT, conforme secao 2. Nao apenas `GRANT TO authenticated, service_role`.

3. **Story 3-A** — a migration de ordenacao e segura e necessaria para a Opcao D.

4. **Pos-deploy** — executar `NOTIFY pgrst, 'reload schema'` apos cada migration
   de GRANT/REVOKE (ja incluido no template).

### Handoff para @dev

```yaml
handoff:
  agent: "@security"
  verdict: "CONCERNS"
  output_summary: |
    v1 errou ao assumir GRANT explicito e whitelist. Postgres adiciona EXECUTE
    para PUBLIC automaticamente. As 7 RPCs (3 novas + 4 existentes) precisam
    REVOKE FROM PUBLIC + REVOKE FROM anon ANTES do GRANT. Blast adjacente: zero —
    todos os 4 hooks usam cliente autenticado. Story 3-A: segura.
  vulnerabilities:
    - standard: "#3 (grant)"
      file: "supabase/migrations/20260727_rpc_acoes_bi_v5.sql:417"
      severity: "CRITICAL"
      detail: "GRANT TO anon, authenticated, service_role SEM REVOKE FROM PUBLIC — anon herda de PUBLIC e permanece com EXECUTE mesmo sem estar no GRANT. Afeta rpc_acoes_bi, rpc_acoes_funil_gestao, rpc_acoes_mapa_oportunidades."
      fix: "Template de revogacao completo na secao 2 do SEC-REVIEW-v3.md"
    - standard: "#3 (grant)"
      file: "supabase/migrations/20260802_rpc_acoes_funil_gestao_v6_...sql:395-396"
      severity: "CRITICAL"
      detail: "Mesmo problema: GRANT TO anon, authenticated, service_role SEM REVOKE FROM PUBLIC."
      fix: "Idem secao 2. Para as 3 novas RPCs, aplicar template de revogacao antes do GRANT."
    - standard: "#7 (data exposure)"
      file: "4 existentes + 3 novas RPCs"
      severity: "CRITICAL"
      detail: "Todas sao SECURITY DEFINER como postgres. Sem revogacao, QUALQUER pessoa com URL da API pode ler TODO o CRM via PostgREST sem JWT."
      fix: "REVOKE FROM PUBLIC + REVOKE FROM anon antes do GRANT TO authenticated, service_role nas 7 funcoes."
  next_input: |
    Criar migration corretiva com o template da secao 2.
    Ajustar as 3 novas RPCs para aplicar revogacao antes do GRANT.
    Apos deploy: NOTIFY pgrst, 'reload schema'.
```

---

## Veredicto do Gate

Arquivo: `.aivoux/gates/security-verdict.json`

```json
{
  "sha": "2bc7a9e",
  "verdict": "CONCERNS",
  "agent": "aivoux-security",
  "timestamp": "2026-08-03T13:00:00Z",
  "scope": "7 RPCs BI para /bi/acoes — CRIT: GRANT-whitelist e vulneravel em todas. REVOKE FROM PUBLIC + anon obrigatorio."
}
```
