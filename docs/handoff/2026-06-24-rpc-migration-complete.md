# Handoff: Migração BI → RPCs Server-Side (Completa)

**Data:** 2026-06-24  
**Branch:** `perf/bi-quick-wins`  
**Último commit:** `bbf1938` (DRY consolidation: toISODate + unwrapRpc)  
**Status:** PENDENTE_DEPLOY — código pronto, RPCs precisam ser aplicadas no banco + push

---

## Contexto do Problema

O dashboard BI tinha TODAS as telas fazendo agregação no browser: fetch de milhares de rows brutas do Supabase → useMemo com loops/maps/sorts no frontend. Isso não escala — à medida que a base cresce o app fica proporcionalmente mais lento.

**Decisão:** mover toda agregação para RPCs PostgreSQL. Frontend só passa filtros (datas, vendedor, etc.) e recebe JSON pré-agregado pronto para renderizar.

---

## O que foi feito ✅

### 1. Bug fix — Charts vazios no CrmOverview

**Root cause:** Os componentes de chart (`BarChart`, `LineChart`, `PieChart`) recebiam dados via hook mas NÃO recebiam a prop `loading`. O `ChartFrame` interno mostrava "Sem dados" (estado empty) em vez de skeleton durante o fetch.

**Fix:** Adicionada prop `loading={isLoading}` em todos os 5 charts de `CrmOverviewRpc.tsx`. Removida variável `isLoading` morta que era computada mas nunca passada.

### 2. Cinco RPCs novas criadas

**Arquivo:** `supabase/migrations/20260623_create_bi_rpcs.sql` (687 linhas)

| RPC | Params | Retorno | Tabela |
|-----|--------|---------|--------|
| `rpc_negocios_bi` | `p_from date, p_to date, p_funis text[] DEFAULT NULL` | JSON com kpis + funilPorEtapa + porOrigem + motivosPerda + evolucaoMensal + rankingConsultor | `mirror.crm_negocios` JOIN `mirror.usuarios` |
| `rpc_pedidos_bi` | `p_from date, p_to date` | JSON com kpis + evolucaoMensal + porSituacao + mixPagamento + porVendedor + porCidade | `mirror.crm_pedidos` |
| `rpc_servicos_bi` | `p_from date, p_to date` | JSON com kpis + porStatus + faixasResolucao + evolucaoAberturas + situacaoOcorrencias + motivosPausa + causasAtendimento | `mirror.crm_os` |
| `rpc_admin_bi` | nenhum | JSON com kpis + prospectVsAtivo + porTipoCliente + porUF + porConsultor | `mirror.crm_carteira_clientes` JOIN `mirror.usuarios` |
| `rpc_acoes_bi` | `p_from date, p_to date, p_vendedor text, p_tipo_acao text, p_cidade text` (todos DEFAULT NULL) | JSON com kpis + porVendedor + porCidade + porMes + porDiaSemana + porTipoAcao + porTipoContato + listaAnos | `mirror.crm_acoes` |

Todas com: `SECURITY DEFINER`, `STABLE`, `LANGUAGE plpgsql`, `NOTIFY pgrst, 'reload schema'` no final.

### 3. Infraestrutura frontend completa

| Camada | Arquivo | Função |
|--------|---------|--------|
| Types | `src/types/biRpc.ts` (197 linhas) | Interfaces TS para todas 5 RPCs |
| Service | `src/services/bi/biRpcService.ts` (91 linhas) | Funções que chamam `supabase.rpc()` com `unwrapRpc<T>` helper |
| Hook negócios | `src/hooks/bi/useNegociosBIRpc.ts` (32 linhas) | TanStack Query, staleTime 5min |
| Hook pedidos | `src/hooks/bi/usePedidosBIRpc.ts` (30 linhas) | TanStack Query, staleTime 5min |
| Hook serviços | `src/hooks/bi/useServicosBIRpc.ts` (29 linhas) | TanStack Query, staleTime 5min |
| Hook admin | `src/hooks/bi/useAdminBIRpc.ts` (23 linhas) | TanStack Query, staleTime 10min |
| Hook ações | `src/hooks/bi/useAcoesBIRpc.ts` (35 linhas) | TanStack Query, staleTime 5min |
| Hook painel | `src/hooks/bi/usePainelKPIsRpc.ts` (180 linhas) | Compõe negócios + ações RPC + operacional (SQL Server) |

### 4. Sections migradas para RPCs

| Section | Hook antigo (client-side) | Hook novo (server-side) |
|---------|--------------------------|------------------------|
| `ComercialSection.tsx` | `useNegociosBI` | `useNegociosBIRpc` |
| `PedidosSection.tsx` | `usePedidosData` | `usePedidosBIRpc` |
| `ServicosSection.tsx` | `useServicosData` | `useServicosBIRpc` |
| `AdminSection.tsx` | `useAdminData` | `useAdminBIRpc` |
| `AcoesSection.tsx` | `useAcoesBI` | `useAcoesBIRpc` |
| `BiPainel.tsx` | `usePainelKPIs` | `usePainelKPIsRpc` |
| `CrmOverviewRpc.tsx` | já era RPC | fix loading prop |

### 5. DRY cleanup

- `toISODate` consolidado em `src/lib/dateUtils.ts` (era duplicado em 11 arquivos)
- `unwrapRpc<T>` extraído no topo de `biRpcService.ts` (era inline 5x)
- Net: -71 linhas removidas

### 6. Quality gates

- `npm run lint`: PASS (zero errors nos arquivos do branch)
- `npx tsc --noEmit`: PASS (zero type errors)
- `npm run build`: PASS (Vite build OK em 4.30s)
- @reviewer: PASS (zero `any`, todos < 300 linhas, DRY OK)
- @qa: PASS_WITH_OBSERVATIONS (pendente runtime validation)

---

## O que está PENDENTE ⚠️

### Deploy (obrigatório — @devops)

1. **Aplicar migration no banco vivo:**
   ```bash
   # SSH na VPS 178.238.235.203, acessar container DB
   docker exec -i supabase_supabase_db.1.m8y6f3d5q3r31f060kq74ncfm \
     psql -U postgres -d postgres < supabase/migrations/20260623_create_bi_rpcs.sql
   ```
   
2. **Verificar que PostgREST pegou as RPCs:**
   ```bash
   curl -s https://ceressupabasebi.vouxconsultoria.com.br/rest/v1/rpc/rpc_negocios_bi \
     -H "apikey: $ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"p_from":"2026-01-01","p_to":"2026-06-24"}' | head -c 200
   ```

3. **Push da branch + criar PR:**
   ```bash
   git push -u origin perf/bi-quick-wins
   gh pr create --base main --title "perf(bi): migrate all BI sections to server-side RPCs"
   ```

### Smoke test (obrigatório antes de merge — @qa runtime)

- Abrir cada tab BI no browser e confirmar que charts renderizam com dados reais
- Especialmente: BiComercial (funil, origens, motivos), BiPedidos (situação, evolução), CrmOverview (4 charts)
- Conferir que nenhum chart mostra "Sem dados" quando deveria ter dados

### Migração restante (próximas sessões)

| Item | Prioridade | Complexidade |
|------|-----------|--------------|
| BiInteligencia (cross-join 4 domínios) | MEDIUM | ALTA — precisa de RPC que combina negocios+pedidos+parque+OS+acoes |
| CRM pages (7 páginas via ComercialDataContext) | LOW | MÉDIA — as 5 RPCs originais (rpc_kpis_comercial etc.) já cobrem CrmOverview; as demais precisam de RPCs de detalhe |
| BiOperacional (SQL Server) | LOW | N/A — não migrável para RPC Supabase, depende de edge function |
| Remover dead code (hooks antigos) | LOW | FÁCIL — após confirmar que todas sections RPC funcionam em prod |
| Remover `aggregateComercial.ts` + `useComercialData` | LOW | FÁCIL — mas só após migrar CRM pages |

---

## Infraestrutura

- **Repo:** confirmar com `git remote -v` (origin canônico)
- **Branch:** `perf/bi-quick-wins` (ahead of main por vários commits)
- **Banco:** Supabase self-hosted, VPS 178.238.235.203
- **Container DB:** `supabase_supabase_db.1.m8y6f3d5q3r31f060kq74ncfm`
- **Supabase URL:** `https://ceressupabasebi.vouxconsultoria.com.br`
- **Anon key:** no `.env` (VITE_SUPABASE_PUBLISHABLE_KEY)
- **Colunas do banco:** SEM underscore separando prefixo do campo (ex: `NGO_VlrTotalNegociado`)
- **Migration das 5 RPCs originais já aplicada** (testada via curl na sessão anterior)

---

## Decisões técnicas tomadas nesta sessão

1. **RPCs retornam JSON (não SETOF)** para estruturas complexas com KPIs + arrays de charts
2. **Padrão: SECURITY DEFINER + STABLE** (read-only, cacheable pelo PostgREST)
3. **TanStack Query** com staleTime 5min (admin 10min), `placeholderData: keepPreviousData`
4. **Migração incremental** — hooks antigos mantidos como dead code até validação runtime
5. **BiOperacional não migra** — depende de SQL Server via edge function, não é Supabase
6. **rpc_admin_bi sem filtro de data** — tabela carteira_clientes é estática
7. **rpc_servicos_bi**: campos de ocorrências/atendimentos retornam arrays vazios porque essas tabelas estão no SQL Server legado, não no mirror Supabase
8. **unwrapRpc<T>** como helper privado no service (Supabase client pode wrappear JSON em array)
9. **Dedup em rpc_negocios_bi** via DISTINCT ON ngo_numero (corrige pipeline inflado)
10. **Filtro de data em negocios** usa NGO_DataFechamento (exclui NULL = não concluído no período)

---

## Arquivos-chave para a próxima sessão

```
# RPCs (SQL a aplicar no banco)
supabase/migrations/20260623_create_bi_rpcs.sql      # 5 RPCs novas (687 linhas)
supabase/migrations/20260623_create_comercial_rpcs.sql # 5 RPCs originais (368 linhas)

# Frontend — camada RPC
src/types/biRpc.ts                          # Interfaces
src/services/bi/biRpcService.ts             # Service layer
src/hooks/bi/useNegociosBIRpc.ts            # Hook negócios
src/hooks/bi/usePedidosBIRpc.ts             # Hook pedidos
src/hooks/bi/useServicosBIRpc.ts            # Hook serviços
src/hooks/bi/useAdminBIRpc.ts               # Hook admin
src/hooks/bi/useAcoesBIRpc.ts               # Hook ações
src/hooks/bi/usePainelKPIsRpc.ts            # Hook painel (composto)

# Sections migradas
src/components/bi/sections/ComercialSection.tsx
src/components/bi/sections/PedidosSection.tsx
src/components/bi/sections/ServicosSection.tsx
src/components/bi/sections/AdminSection.tsx
src/components/bi/sections/AcoesSection.tsx
src/pages/bi/BiPainel.tsx

# CrmOverview (fix)
src/pages/crm/CrmOverviewRpc.tsx

# Utility consolidada
src/lib/dateUtils.ts                         # toISODate agora mora aqui

# Dead code a remover DEPOIS de validação runtime:
src/hooks/bi/useNegociosBI.ts               # Substituído por useNegociosBIRpc
src/hooks/bi/usePedidosData.ts              # Substituído por usePedidosBIRpc
src/hooks/bi/useServicosData.ts             # Substituído por useServicosBIRpc
src/hooks/bi/useAdminData.ts                # Substituído por useAdminBIRpc
src/hooks/bi/useAcoesBI.ts                  # Substituído por useAcoesBIRpc
src/hooks/bi/usePainelKPIs.ts              # Substituído por usePainelKPIsRpc
src/lib/aggregateComercial.ts               # Será removido quando CRM pages migrarem
src/hooks/useComercialData.ts               # Será removido quando CRM pages migrarem
```

---

## Commits nesta sessão (branch perf/bi-quick-wins)

| SHA | Mensagem |
|-----|----------|
| `a7bda6d` | fix(bi): add loading prop to charts + create rpc_negocios_bi and rpc_pedidos_bi |
| (wave 2) | feat(bi): create rpc_servicos/admin/acoes + migrate sections to RPC hooks |
| `bbf1938` | refactor(bi): consolidate toISODate in dateUtils + extract unwrapRpc helper |

---

## Na próxima sessão, comece por:

1. Ler este handoff
2. Aplicar migration no banco (`20260623_create_bi_rpcs.sql`) via SSH no container
3. Testar cada RPC com curl (confirmar que retorna JSON com dados reais)
4. Abrir o app no browser e confirmar que os charts renderizam
5. Se tudo OK: push + PR
6. Se charts ainda vazios: debug com console.log nos retornos dos hooks (o loading fix já está — seria outro issue)
