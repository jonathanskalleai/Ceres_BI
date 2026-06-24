# Plano: BI Performance — Eliminação de Client-Side Aggregation

**Data:** 2026-06-24
**Branch:** `perf/bi-quick-wins`
**Status:** EM EXECUÇÃO (Fase 1 nesta sessão, Fase 2 próxima)

---

## Diagnóstico

O problema central: dados brutos viajam para o browser (10k-50k rows) e são agregados em useMemo. Causa lentidão de 2-5s. Solução: mover TODA agregação para RPCs PostgreSQL.

### Estado por tela

| Tela | Status | Causa |
|------|--------|-------|
| BiPainel | LENTO | 9 RPCs paralelas + useOperacionalData (SQL Server) |
| BiComercial | LENTO | useFunilData puxa tabela inteira |
| BiPedidos | LENTO | usePedidosItensData puxa tabela inteira sem filtro |
| BiServicos | ZERADO | 0 registros em junho 2026 (total 45 OS) — range curto |
| BiProdutos | LENTO | 100% client-side |
| BiOperacional | LENTO | SQL Server legado |
| BiInteligencia | CRÍTICO | 5 fetches (50k rows) + 4 useMemo pesados |
| CRM pages | MÉDIO | useComercialDataContext (fetch rows) |

---

## Fase 1 — Quick-wins (sessão atual)

### 1.1 Fix BiServiços range
- Inicializar com 12 meses (subMonths 11) em vez de mês atual

### 1.2 Expandir rpc_pedidos_bi
- Adicionar `porGrupoProduto` e `porMarcaProduto` (top 10 cada)
- Usa mirror.crm_pedidos_item (sem FK de data — agrega inteira, volume aceitável)
- Elimina: usePedidosItensData + pedidosItemBIService

### 1.3 Expandir rpc_negocios_bi
- Adicionar `velocidadeFunil` e `duracaoMediaTotal`
- Usa mirror.crm_funil_etapa (AVG dias por etapa)
- Elimina: useFunilData + funilBIService

### 1.4 Criar rpc_produtos_bi
- KPIs: totalMaquinas, clientesComParque, gruposDistintos, marcasDistintas
- Arrays: porGrupo, porMarca, topModelos (top 10 cada)
- Usa mirror.cliente_parque_maquinas
- Elimina: useProdutosData + produtosBIService

### 1.5 Dead code cleanup
- Hooks: usePedidosItensData, useFunilData, useProdutosData
- Services: pedidosItemBIService, funilBIService, produtosBIService

---

## Fase 2 — Trabalho pesado (próxima sessão)

### 2.1 Criar rpc_inteligencia_bi (PRIORIDADE 1)
- Cross-domain: negocios + pedidos + parque + OS + acoes
- 4 blocos: winRate/motivosPerda, mixFaturamento/shareBanco, frotaRenovacao, slaPorFilial
- ~150 linhas SQL, testar com EXPLAIN ANALYZE
- Elimina: useInteligenciaBI (pior hook do projeto)

### 2.2 Mirror SQL Server (PRIORIDADE 2)
- Adicionar ao ETL Python: VW_Ceres_TecnicoTempo, VW_Ceres_Agenda, VW_Ceres_AtendimentoOS, VW_Ceres_Ocorrencias
- Criar tabelas mirror: tecnico_tempo, agenda, atendimento_os, ocorrencias
- Criar rpc_operacional_bi(p_from, p_to)
- Elimina: useOperacionalData + operacionalBIService

### 2.3 Consolidar BiPainel (PRIORIDADE 3)
- Alterar 5 RPCs para retornar {atual, anterior} em uma só chamada (YoY embutido)
- Reduz BiPainel de 9 RPCs para 5
- Roadmap futuro: rpc_painel_bi única

### 2.4 Migrar CRM pages (PRIORIDADE 4)
- Substituir useComercialDataContext por RPCs existentes
- Criar rpc_crm_filters() para dropdowns (distinct funis, vendedores, cidades)
- Elimina: useComercialData + ComercialDataContext

---

## Sequência de execução

### Fase 1

| # | Agente | Ação |
|---|--------|------|
| 1 | @data-engineer | SQL: expandir rpc_pedidos_bi + rpc_negocios_bi, criar rpc_produtos_bi |
| 2 | @devops | Aplicar SQL no banco vivo |
| 3 | @dev | Fix BiServiços range + criar useProdutosBIRpc + atualizar Sections |
| 4 | @dev | Deletar dead code |
| 5 | @devops | Push + update PR |

### Fase 2

| # | Agente | Ação |
|---|--------|------|
| 1 | @architect | Design SQL rpc_inteligencia_bi |
| 2 | @data-engineer | Implementar + deploy |
| 3 | @dev | Criar hook + migrar InteligenciaSection |
| 4 | @data-engineer | Mirror 4 tabelas operacionais |
| 5 | @dev | Alterar ETL Python + migrar OperacionalSection |
| 6 | @data-engineer | Alterar 5 RPCs com YoY embutido |
| 7 | @dev | Simplificar BiPainel |
| 8 | @dev | Migrar CRM pages |
| 9 | @qa | Full regression |

---

## Infra

- Repo: origin https://github.com/jonathanskalleai/Ceres_BI.git
- Banco: Supabase self-hosted, VPS 178.238.235.203
- Container DB: supabase_supabase_db.1.m8y6f3d5q3r31f060kq74ncfm
- PostgREST: supabase_supabase_rest.1.0909dxxfjhu8jh1m4irowptxv
- Colunas: lowercase sem underscore separando prefixo (pdo_vlrpedido, ngo_numero)
- crm_pedidos_item NÃO tem FK para crm_pedidos (sem coluna de data)
