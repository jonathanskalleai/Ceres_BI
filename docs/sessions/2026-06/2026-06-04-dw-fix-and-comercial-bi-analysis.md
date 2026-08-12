# Handoff — Sessão 2026-06-04

## Contexto

### O que foi feito nesta sessão

1. **DW corrigido e funcional** — O sync Campus Dealer → Supabase mirror estava quebrado para `crm_negocios` (0 registros) e `crm_carteira_clientes` (0 registros). Causa: PK duplicada + edge function com timeout.
2. **Carga inicial completa** — Todas as 9 views populadas no Supabase.
3. **Cron incremental configurado** — A cada 15min no host da VPS (`/root/supabase/sync-mirror.sh`).
4. **`negociosService.ts` migrado** — Frontend agora lê exclusivamente do Supabase (mirror), não mais da edge function legada.
5. **Build passa** — `tsc --noEmit` + `vite build` OK.

### Arquivos modificados (não commitados)

- `src/services/negociosService.ts` — migrado de `fetchAllPages` (edge function) para PostgREST (mirror)

### Infraestrutura (VPS 178.238.235.203)

- Edge function `sync-campus-dealer` atualizada (colunas novas em crm_negocios + watermark map + strategy incremental)
- Colunas adicionadas em `mirror.crm_negocios`: `cli_nome`, `cli_cidade`, `emp_cidade`, `emp_uf`, `prd_condicao_produto`, `usa_valor`, `ngo_obs_negocio`
- `pg_cron` desabilitado (não funcionava via pg_net interno); substituído por crontab no host
- Watermark de `VW_Ceres_OrdemServico` corrigido para formato ISO

---

## Próxima demanda: Duplicação Comercial × BI

### Problema

Existem **indicadores duplicados** entre duas áreas do sistema:

| Indicador | Comercial (`PerformanceComercial.tsx`) | BI (`ComercialSection.tsx`) |
|---|---|---|
| Total de Negócios | ✅ | ✅ |
| Taxa de Conversão | ✅ | ✅ |
| Valor Ganho / Realizado | ✅ | ✅ |
| Evolução Mensal de Vendas | ✅ (recharts) | ✅ (echarts) |
| Ranking de Consultores | ✅ | ✅ |
| Pipeline Aberto | ✅ | ✅ |
| Ticket Médio | ✅ | ✅ |

### O que é exclusivo de cada área

**Só no BI (ComercialSection):**
- Funil por Etapa (valor em aberto por etapa)
- Origem do Lead (conversão por canal)
- Motivos de Perda (onde a receita vaza)
- Velocidade do Funil (gargalos em dias)
- Ciclo de Vendas (média dias)
- Esforço Médio (ações/negócio)

**Só no Comercial (PerformanceComercial):**
- Meta Anual / Gap / Projeção
- Recebido / Usados (financeiro)
- CRM Ações (visitas, contatos) — dados de `crm_acoes`
- Clientes com Potencial
- Alertas de performance
- Apresentação 2026

### Decisão necessária (para discussão dos agentes)

1. **Consolidar em uma tela só** (mover os exclusivos do Comercial para o BI e deprecar PerformanceComercial)?
2. **Manter separado** mas eliminar os duplicados (cada indicador aparece em apenas um lugar)?
3. **Manter como está** — mesmo dado visto de ângulos diferentes é intencional?

### Fontes de dados (agora unificadas)

Ambas as áreas leem do **mesmo mirror Supabase**:
- `useNegociosBI` → `mirror.crm_negocios` (BI)
- `useNegociosData` → `mirror.crm_negocios` + `mirror.crm_pedidos` (Comercial)
- `useComercialData` → `mirror.crm_acoes` (Comercial)

### Arquivos relevantes

- `src/pages/PerformanceComercial.tsx` — página Comercial (~450 linhas)
- `src/components/bi/sections/ComercialSection.tsx` — aba Comercial do BI (~188 linhas)
- `src/hooks/bi/useNegociosBI.ts` — hook BI
- `src/hooks/useNegociosData.ts` — hook Comercial
- `src/hooks/useComercialData.ts` — hook CRM ações
- `src/pages/Dashboard.tsx` — shell do dashboard (sidebar + views)

### Recomendação técnica

A `ComercialSection` do BI é mais enxuta, usa o design system (echarts + KPICard), e tem insights mais ricos (motivos de perda, gargalos). O `PerformanceComercial` tem valor nos dados financeiros (meta/gap/recebido/usados) e na visão de ações CRM. Uma consolidação faria sentido mantendo os dados financeiros + ações como tabs ou seções adicionais dentro do BI.

---

## Branch

`main` (mudanças locais não commitadas)

## Status

`PENDENTE_PUSH` — `negociosService.ts` modificado, precisa commit + push após decisão sobre o escopo do Comercial.
