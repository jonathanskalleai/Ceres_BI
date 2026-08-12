# Handoff: Fase 1 BI Performance — Progress

**Data:** 2026-06-24
**Branch:** `perf/bi-quick-wins`
**Último commit:** (verificar com git log -1)
**Status:** EM ANDAMENTO — RPCs SQL aplicadas no banco, frontend parcial, PostgREST issue com rpc_produtos_bi

---

## O que foi feito nesta sessão ✅

### 1. Migration original aplicada
- 5 RPCs (`rpc_negocios_bi`, `rpc_pedidos_bi`, `rpc_servicos_bi`, `rpc_admin_bi`, `rpc_acoes_bi`) aplicadas no banco vivo
- Fixes de tipo: `NULLIF(...,'')::numeric` em negocios (ngo_ciclovendas, ngo_qtdacoes) e `::numeric` em ROUND de servicos
- Smoke test: todas 5 retornando dados reais via curl ✅

### 2. Fix BiPedidos/BiServicos zerados
- Root cause: `dateRange` iniciava `undefined` → query nunca disparava
- Fix: inicializado com `startOfMonth/endOfMonth` do mês atual
- Commit: `514712f`

### 3. BiPainel refatorado para RPCs
- Criados 4 hooks RPC wrappers: `usePedidosKPIsRpc`, `useClientesKPIsRpc`, `useServicosKPIsRpc`, `useCrossKPIsRpc`
- BiPainel.tsx atualizado para usar esses hooks
- Trade-off: trend (seta up/down) temporariamente "neutral" — RPCs não têm período anterior
- Único gargalo residual: `useOperacionalData` (SQL Server legado)

### 4. Fase 1 SQL — RPCs expandidas e criadas no banco
- `rpc_pedidos_bi` expandida com `porGrupoProduto` e `porMarcaProduto` (top 10 cada, mirror.crm_pedidos_item) ✅
- `rpc_negocios_bi` expandida com `velocidadeFunil` e `duracaoMediaTotal` (mirror.crm_funil_etapa) ✅
- `rpc_produtos_bi` criada (mirror.cliente_parque_maquinas: kpis, porGrupo, porMarca, topModelos) ⚠️

### 5. Push + PR
- PR #2: https://github.com/jonathanskalleai/Ceres_BI/pull/2
- SHA remoto: `8040fd5` (antes dos commits de Fase 1 frontend — SQL edits não commitados ainda)

### 6. Plano completo documentado
- `docs/handoff/2026-06-24-bi-performance-plan.md` — Fase 1 + Fase 2 com SQL, sequência, dead code

---

## O que está PENDENTE ⚠️

### Issue: PostgREST não reconhece rpc_produtos_bi

**Sintoma:** PostgREST carrega "33 Functions" no schema cache. `rpc_admin_bi()` (sem params) funciona, mas `rpc_produtos_bi()` (sem params, criada depois) NÃO aparece.

**Investigação feita:**
- Função existe em pg_proc (schema public, 0 params, json return, STABLE, SECURITY DEFINER)
- GRANT EXECUTE para anon, authenticated, authenticator — todos `true`
- DROP + CREATE OR REPLACE — não resolveu
- Tentativa com param dummy (p_dummy text DEFAULT NULL) — não resolveu
- PostgREST reiniciado múltiplas vezes — sempre "33 Functions"
- Logs mostram schema cache OK, sem erros

**Hipótese:** PostgREST 13.0.7 pode ter um limite ou filtro adicional. O número "33 Functions" é constante, sugerindo que algo filtra além de schema+grant. Possibilidade: o `authenticator` role precisa de mais do que EXECUTE (talvez USAGE no schema ou grant no OWNER). Ou há uma config de allowlist.

**Próximo passo:** Investigar se PostgREST usa `pg_catalog` queries com filtro adicional (ex: `search_path` do role authenticator). Comparar `pg_get_functiondef` entre admin e produtos. Verificar se o problema é que as novas RPCs expandidas (pedidos, negocios) TAMBÉM não estão no cache mas como são CREATE OR REPLACE de funções existentes, o PostgREST já as conhecia.

---

### Frontend pendente (Fase 1)

1. **BiServicos range** — mudar inicialização para 12 meses (`subMonths(new Date(), 11)`) em vez de mês atual
2. **PedidosSection** — consumir `data.porGrupoProduto` / `data.porMarcaProduto` da RPC, remover `usePedidosItensData`
3. **ComercialSection** — consumir `data.velocidadeFunil` da RPC, remover `useFunilData`
4. **BiProdutos** — criar `useProdutosBIRpc` hook + migrar `ProdutosSection` (depende de resolver PostgREST issue)
5. **Dead code cleanup** — deletar hooks/services obsoletos
6. **Atualizar migration SQL local** — refletir os CREATE OR REPLACE expandidos
7. **Push final + smoke test browser**

---

## Fase 2 (próxima sessão depois de concluir Fase 1)

Detalhado em `docs/handoff/2026-06-24-bi-performance-plan.md`:
- rpc_inteligencia_bi (cross-domain, elimina pior tela)
- Mirror SQL Server (4 tabelas operacionais)
- Consolidar BiPainel (YoY embutido, reduzir 9→5 RPCs)
- Migrar CRM pages

---

## Infra

- **Repo:** origin https://github.com/jonathanskalleai/Ceres_BI.git
- **Branch:** `perf/bi-quick-wins`
- **VPS:** 178.238.235.203 (root / 5qv2fJT3Cv5W36RrY)
- **Container DB:** supabase_supabase_db.1.m8y6f3d5q3r31f060kq74ncfm
- **Container PostgREST:** supabase_supabase_rest.1.0909dxxfjhu8jh1m4irowptxv (v13.0.7)
- **PostgREST schemas:** public, storage, graphql_public, mirror
- **PostgREST DB role:** authenticator (connects as this, then switches to anon/authenticated)
- **Supabase URL:** https://ceressupabasebi.vouxconsultoria.com.br
- **Anon key:** no .env (VITE_SUPABASE_PUBLISHABLE_KEY)

---

## Na próxima sessão, comece por:

1. Ler este handoff + `docs/handoff/2026-06-24-bi-performance-plan.md`
2. Resolver PostgREST issue com `rpc_produtos_bi` (investigar filtro de 33 funções)
3. Concluir frontend Fase 1 (itens 1-7 acima)
4. Push + smoke test
5. Se tempo sobrar: iniciar Fase 2 (rpc_inteligencia_bi)
