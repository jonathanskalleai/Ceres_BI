---
feature: painel-bi
updated_at: 2026-08-04T00:00:00Z
updated_by: "@dev + Codex adversarial review"
status: active
---

# Painel BI — KPIs alinhados com v9 (Ações)

**Proposito:** Tela /bi/painel (Visao Geral) com indicadores sincronizados com a logica v9 da tela Acoes.

## Entry Points
- `src/pages/bi/BiPainel.tsx` — pagina principal (rota /bi/painel)
- `src/components/bi/painel/PainelValoresSection.tsx` — cards de valor (v9)
- `src/components/bi/painel/PainelNegociosSection.tsx` — cards de negocio (v9)
- `src/components/bi/painel/PainelAcoesSection.tsx` — cards de acao + gestao
- `src/components/bi/painel/StatusDesconhecidoAlert.tsx` — alerta de status desconhecido (NOVO)

## Dependencias Internas
- `src/hooks/bi/usePainelKPIsRpc.ts` — hook principal com fontes v9
- `src/hooks/bi/useAcoesBIRpc.ts` — fetch para rpc_acoes_bi
- `src/hooks/bi/useNegociosBIRpc.ts` — fetch para rpc_negocios_bi
- `src/hooks/bi/useAcoesFunilRpc.ts` — fetch para rpc_acoes_funil_gestao

## Logica v9 (Contrato de Fontes)

| Card | Fonte | Data de competencia | Unidade |
|------|-------|-------------------|---------|
| Valor Ganho | `rpc_acoes_bi.kpis.valorGanho` | `pdo_dthaprovacao` | R$ pedido aprovado |
| Valor Perdido | `rpc_acoes_bi.kpis.valorPerdido` | `ngo_datafechamento` | R$ negociado potencial |
| Ganhos (qtd) | `rpc_acoes_bi.kpis.negociosGanho` | `pdo_dthaprovacao` | pedidos |
| Perdidos (qtd) | `rpc_acoes_bi.kpis.negociosPerdido` | `ngo_datafechamento` | negocios |
| Pipeline Aberto | `rpc_acoes_funil_gestao.funil.valorOportunidades` | — | oportunidades tocadas |

**Mantidos de rpc_negocios_bi:**
- Taxa Conversao
- Total Negocios
- Em Andamento

## KPIs de Gestao (Novos)
- Oportunidades Abertas Tocadas
- Visitas por Oportunidade
- Dias Parados (mediana)

## Campo ignoresFunilFilter

KPIs que NAO obedecem ao filtro de categoria/funil:
- `ganhos`, `perdidos`, `valorGanho`, `valorPerdido`
- `totalAcoes`, `totalVisitas`, `ticketMedio`, `totalOS`
- `negociosOutrosStatus`

## Como Alterar com Seguranca
1. Nao misturar fontes: valorGanho vem de `rpc_acoes_bi`, nao de `rpc_negocios_bi`
2. Pipeline Aberto usa `valorOportunidades` do funil (nao todos abertos)
3. Adicionar novo KPI em `ignoresFunilFilter` se vier de RPC sem filtro de funis

## Smoke
- `npm run build` — sucesso
- Valores de Valor Ganho/Perdido batem com a tela Acoes no mesmo periodo
- Pipeline Aberto mostra valorOportunidades (nao mais todos abertos)
- StatusDesconhecidoAlert aparece se negociosOutrosStatus > 0
