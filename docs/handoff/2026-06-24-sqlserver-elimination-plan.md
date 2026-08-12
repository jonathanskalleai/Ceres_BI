# Handoff: Eliminar SQL Server do Frontend

**Data:** 2026-06-24
**Branch:** perf/bi-quick-wins
**Status:** PLANEJADO (próxima sessão)
**Prioridade:** ALTA — é o principal gargalo de performance do BI

---

## Problema

O frontend chama uma Edge Function `query-sqlserver` que faz proxy direto para o
CampDealer (SQL Server). Isso viola a arquitetura do data warehouse:

> Frontend → Supabase (mirror/RPCs) → NUNCA SQL Server direto

Cada call leva segundos, bloqueia o carregamento das telas BI, e impede que o
painel carregue rápido mesmo com as RPCs otimizadas.

---

## Mapa de violações

| Service | View SQL Server | Hook que usa | Tela afetada |
|---------|----------------|--------------|--------------|
| `operacionalBIService.ts` | `VW_Ceres_TecnicoTempo` | `useOperacionalData` → `usePainelKPIsRpc` | BiPainel, BiOperacional |
| `operacionalBIService.ts` | `VW_Ceres_Agenda` | `useOperacionalData` | BiPainel, BiOperacional |
| `servicosBIService.ts` | `VW_Ceres_AtendimentoOS` | `useInteligenciaBI` | BiInteligencia |
| `servicosBIService.ts` | `VW_Ceres_Ocorrencias` | `useInteligenciaBI` | BiInteligencia |
| `adminBIService.ts` | `VW_Ceres_Empresas` (count) | `useClientesKPIs` | BiAdmin |
| `adminBIService.ts` | `VW_Ceres_Usuario` (count) | `useClientesKPIs` | BiAdmin |
| `DashboardViewExplorer.tsx` | qualquer view (debug tool) | direto | Tools/Explorer |

### O que já está certo (usa mirror)

- `servicosBIService.ts` → `fetchOrdensServico()` usa `mirror.ordens_servico` ✓
- `adminBIService.ts` → `fetchCarteira()` usa `mirror.crm_carteira_clientes` ✓

---

## Views que precisam ser espelhadas

| View SQL Server | Dados | Tabela mirror proposta |
|-----------------|-------|------------------------|
| `VW_Ceres_TecnicoTempo` | Produtividade técnicos (tempo, km, ocioso) | `mirror.tecnico_tempo` |
| `VW_Ceres_Agenda` | Agendamentos (status, tipo, técnico) | `mirror.agenda_servico` |
| `VW_Ceres_AtendimentoOS` | Causas e duração de atendimentos | `mirror.atendimentos_os` |
| `VW_Ceres_Ocorrencias` | Motivos pausa, situação ocorrência | `mirror.ocorrencias_os` |
| `VW_Ceres_Empresas` | Apenas count | Embutir em `rpc_admin_bi` |
| `VW_Ceres_Usuario` | Apenas count | Embutir em `rpc_admin_bi` |

---

## Plano de execução

### Fase A — Eliminar SQL Server do frontend (prioridade máxima)

1. **ETL:** Adicionar as 4 views ao script Python de mirror (`etl/mirror_sqlserver.py` ou equivalente)
   - Criar tabelas: `mirror.tecnico_tempo`, `mirror.agenda_servico`, `mirror.atendimentos_os`, `mirror.ocorrencias_os`
   - Rodar sync inicial

2. **Counts (Empresas/Usuario):** Embutir na `rpc_admin_bi` como campos extras
   - Ou criar tabelas mirror se necessário para mais que count

3. **Reescrever services:**
   - `operacionalBIService.ts` → consumir de `mirror.tecnico_tempo` + `mirror.agenda_servico`
   - `servicosBIService.ts` → `fetchAtendimentosOS` e `fetchOcorrencias` consumir mirror
   - `adminBIService.ts` → `fetchOrgCounts` consumir mirror ou RPC

4. **Opcional (performance extra):** Criar RPCs `rpc_operacional_bi` e `rpc_inteligencia_bi`
   que agreguem no servidor

5. **Remover/restringir `sqlServerApi.ts`:**
   - Manter apenas para `DashboardViewExplorer` (tool admin/debug)
   - Ou remover completamente se o Explorer pode usar mirror

### Fase B — Deduplicar RPCs no BiPainel

6. Verificar queryKeys + params dos hooks compostos vs sections
7. Unificar params para React Query deduplicar naturalmente
8. Alternativa: BiPainel usar dados dos sections via context

---

## Dependências

- Acesso ao ETL Python (verificar se `etl/` existe ou se é o script documentado em `docs/handoff/etl-python-supabase.md`)
- Credenciais SQL Server para o ETL (já configuradas no backend Supabase)
- Após mirror: migrations para criar as 4 tabelas novas

---

## Resultado esperado

- BiPainel carrega em <2s (hoje: 8-15s por causa do SQL Server)
- Todas as telas BI consomem apenas Supabase
- `query-sqlserver` Edge Function removida do path crítico do BI
- Arquitetura data warehouse respeitada: ETL → mirror → RPC → frontend
