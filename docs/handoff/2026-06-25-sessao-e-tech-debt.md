# Handoff: Plano Sessão E — Tech Debt & Validação de Dados

**Data:** 2026-06-25  
**Branch:** `perf/bi-quick-wins`  
**Último commit:** (pós runtime fixes)  
**Status:** PLANEJADO — não iniciado

---

## Contexto

Sessões C+D mataram o ComercialDataContext e migraram 9 páginas CRM para RPCs. O BI está funcional. Porém, foram identificados débitos técnicos que afetam **confiabilidade dos dados** e **manutenibilidade**.

---

## Débitos Técnicos (priorizados)

### 🔴 Alta Prioridade — Afeta Dados/Confiabilidade

| # | Item | Risco | Onde | Ação sugerida |
|---|------|-------|------|---------------|
| 1 | RPCs sem validação de datas futuras | Usuário seleciona range futuro → dados parciais parecem "queda" | Todas as RPCs | Clamp `p_to` em `CURRENT_DATE` dentro das RPCs |
| 2 | rpc_negocios_crm retorna JSON flat | Novo dev que chamar direto sem adapter crashará | `rpc_negocios_crm` no banco | Reestruturar SQL para retornar `{ summary: {...}, evolucaoMensal: [...] }` nativo |
| 3 | Dedup `DISTINCT ON ngo_numero` sem critério estável | Duplicados com timestamps iguais → resultado não-determinístico | `rpc_negocios_crm`, `rpc_negocios_bi` | Adicionar tiebreaker ao ORDER BY (ex: `ngo_datacadastro DESC, ngo_numero`) |
| 4 | `taxaConversao` cruza tabelas por NOME (texto livre) | `aco_vendedor` (nome) vs `ngo_vendedores` (código) — join frágil | `rpc_negocios_crm` | Normalizar: usar tabela `usuarios` como ponte (cod → nome) para ambos os lados |

### 🟡 Média Prioridade — UX/Manutenção

| # | Item | Impacto | Onde | Ação sugerida |
|---|------|---------|------|---------------|
| 5 | 10 Dashboards aceitam `DadosComerciais` (god object) | Cada page preenche 2-3 campos e zera o resto — difícil entender dependências reais | `src/components/dashboard/` | Migrar props para interfaces específicas por Dashboard |
| 6 | DashboardMapa (572 linhas) | Monolito pré-existente | `DashboardMapa.tsx` | Quebrar em sub-componentes (MapView, MapControls, MapLegend) |
| 7 | `NegociosSummaryInput` duplicada | Interface idêntica em 2 hooks | `usePerformanceData.ts`, `usePerformanceMetrics.ts` | Extrair para `src/types/performanceTypes.ts` |
| 8 | CrmCriticos busca 5000 registros (2 anos) | Lento se base crescer | `CrmCriticos.tsx` | Criar `rpc_clientes_criticos` dedicada (calcula diasSemContato no servidor) |

### 🟢 Baixa Prioridade — Cosmético

| # | Item | Onde | Ação |
|---|------|------|------|
| 9 | Comentários referenciando código deletado | 4 arquivos CRM | Limpar |
| 10 | Typo `NegociiosFilterProvider` (2 i's) | `NegociosFilterContext.tsx` | Renomear |

### 📦 Isolado (decisão do cliente)

| # | Item | Impacto | Onde | Ação |
|---|------|---------|------|------|
| 11 | `Apresentacao2026.tsx` (610 linhas) + `negociosService.ts` | Único fetch legado (não-RPC). Rota `/tools/performance` | `src/components/performance/` | Aguardar definição do cliente sobre o que essa tela deve ser |

---

## Recomendação de Execução

**Sessão E — fase 1 (dados):** Itens #1, #3, #4 — impactam validação com cliente  
**Sessão E — fase 2 (estrutura):** Itens #5, #6, #7, #8 — melhoram manutenibilidade  
**Sessão F (se necessário):** Item #11 — depende de decisão do cliente  

---

## Infraestrutura

- **Repo:** `git@github.com:jonathanskalleai/Ceres_BI.git`
- **Branch:** `perf/bi-quick-wins`
- **PR:** #2 (open)
- **VPS:** 178.238.235.203
- **Schema reload:** `docker kill --signal=SIGUSR1 <postgrest_container>`
