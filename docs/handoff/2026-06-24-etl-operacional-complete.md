# Handoff — 2026-06-24: ETL Operacional + SQL Server Elimination Progress

## O que foi feito nesta sessão

### 1. RPCs BI — todas funcionando
- 5 RPCs BI (`rpc_negocios_bi`, `rpc_pedidos_bi`, `rpc_servicos_bi`, `rpc_admin_bi`, `rpc_acoes_bi`) já estavam aplicadas no banco
- `rpc_produtos_bi` estava bloqueada por schema cache stale do PostgREST → **resolvido** com `docker service update --force supabase_supabase_rest`
- Todas as 6 RPCs testadas com smoke test via curl — 200 OK com dados reais

### 2. adminBIService.ts migrado
- Removida dependência de `sqlServerApi` (querySqlServer)
- `fetchOrgCounts` + `OrgCounts` eram dead code (0 consumidores) — removidos
- Arquivo final: 45 linhas, typecheck + build limpos
- `fetchCarteira` já usava mirror schema direto (não SQL Server)

### 3. 4 tabelas mirror operacionais criadas
- Migration: `supabase/migrations/20260624_create_operacional_mirrors.sql`
- Tabelas: `mirror.tecnico_tempo`, `mirror.agenda_servico`, `mirror.atendimentos_os`, `mirror.ocorrencias_os`
- Aplicada na VPS (`178.238.235.203`) com sucesso
- Inclui índices, RLS (anon read / service write), sync_metadata e sync_control

### 4. ETL Python estendido e executado
- **Localização:** `/opt/etl-docker/` na VPS
- **Mappings:** 4 novas entradas em `/opt/etl-docker/transformers/mappings.py` (tecnico_tempo, agenda_servico, atendimentos_os, ocorrencias_os)
- **Config corrigido:** PostgreSQL host `172.19.0.2` (Docker interno, não `10.0.1.220`), database `CamposDealer_BI`
- **Bugs fixados no ETL:**
  - `datetime.date` sem `tzinfo` → check `hasattr(val, 'tzinfo')` em vez de `hasattr(val, 'strftime')`
  - Watermark query usava nome SQL Server (`dthRegistro`) no PostgreSQL → mapeado para `dth_registro`
  - Placeholder `?` → `%s` (pymssql usa `%s`, não `?`)
- **Full load executado** via `/opt/etl-docker/full_load.py`:
  - tecnico_tempo: 8.856 rows
  - agenda_servico: 152 rows
  - atendimentos_os: 152 rows
  - ocorrencias_os: 1.027 rows
- **ETL incremental** funciona via `etl_campos_dealer.py --table X --once`
- **PENDENTE:** configurar cron para rodar periodicamente (ex: a cada 5 min)

### 5. Edge Function sync-campus-dealer atualizada (BYPASS)
- Os 4 ViewConfigs foram adicionados ao `supabase/functions/sync-campus-dealer/index.ts` no código local
- **NÃO usar a Edge Function para estas views** — CPU time limit do Deno isolate estoura com TecnicoTempo (8.800 rows)
- O Python ETL na VPS é o caminho correto para estas views grandes
- A Edge Function pode continuar rodando as views CRM menores

## Estado atual do SQL Server elimination

| Service | Status | Blocker |
|---------|--------|---------|
| `adminBIService.ts` | ✅ Migrado | - |
| `operacionalBIService.ts` | ❌ Ainda usa SQL Server | Precisa consumir mirror/RPC |
| `servicosBIService.ts` | ❌ Ainda usa SQL Server | Precisa consumir mirror/RPC |
| `DashboardViewExplorer.tsx` | ❌ Debug tool, baixa prioridade | - |

## Próxima sessão DEVE

1. **Reescrever `operacionalBIService.ts`** para consumir de `mirror.tecnico_tempo` + `mirror.agenda_servico` (via Supabase client direto ou criar `rpc_operacional_bi`)
2. **Reescrever `servicosBIService.ts`** para consumir de `mirror.atendimentos_os` + `mirror.ocorrencias_os` (via Supabase client direto ou criar `rpc_inteligencia_bi`)
3. **Configurar cron** para o ETL Python (`/opt/etl-docker/etl_campos_dealer.py --once`) — rodar a cada 5 minutos na VPS
4. **Deduplicar RPCs no BiPainel** — queryKeys/params unificados
5. **(Opcional)** Remover/restringir `sqlServerApi.ts` após todos os services migrarem
6. **Commit + push** das mudanças desta sessão (migration, adminBIService, Edge Function update)

## Infra (referência rápida)

- **VPS:** `178.238.235.203` (root / `5qv2fJT3Cv5W36RrY`)
- **Supabase URL:** `https://ceressupabasebi.vouxconsultoria.com.br`
- **PostgreSQL (Docker):** `172.19.0.2:5432` (user: supabase_admin)
- **SQL Server:** `wfrsistemas.net.br:1433` (database: CamposDealer_BI, user: usrBI_CresCandiotto)
- **ETL Python:** `/opt/etl-docker/` (venv em `.venv/`)
- **Edge Functions volume:** `/root/supabase/docker/volumes/functions/`
- **PostgREST schema reload:** `NOTIFY pgrst, 'reload schema';` ou `docker service update --force supabase_supabase_rest`

## Branch

`perf/bi-quick-wins` — último commit local pendente push.

## Arquivos modificados nesta sessão (não commitados)

- `src/services/bi/adminBIService.ts` — migrado de SQL Server para RPC
- `supabase/migrations/20260624_create_operacional_mirrors.sql` — 4 tabelas mirror
- `supabase/functions/sync-campus-dealer/index.ts` — 4 ViewConfigs adicionados (mas NÃO usar para estas views, usar Python ETL)
