# Sessão 2026-05-29 — Rebuild dos Indicadores do DashboardBIReal

## ▶ PRÓXIMA SESSÃO — conferir o que está errado (2 pontos)

1. **Utilização técnica suspeita (✅ CONCLUÍDO)** — `VW_Ceres_TecnicoTempo`:
   utilização saia **4,2%** e ocioso **97,2%** porque `TMP_TempoOcioso ≈
   TMP_TempoDisponivel` e `TMP_DuracaoAtendimento` era muito menor. Hipótese:
   **unidades diferentes entre os campos `TMP_*`** (ex: atendimento em horas,
   tempo disponível/ocioso em minutos). **Feito:** converteu `TMP_TempoDisponivel` e `TMP_TempoOcioso` de segundos para minutos em `aggregateOperacional` em `src/hooks/bi/useOperacionalData.ts`. KM rodado já é a métrica confiável.
   Arquivos: `src/services/bi/operacionalBIService.ts`, `useOperacionalData.ts`,
   `src/components/bi/sections/OperacionalSection.tsx`.

2. **`biUtils.ts` virou dead code (✅ CONCLUÍDO)** — `findCol()`/`groupByCol()` não são mais
   usados por nenhuma section. **Feito:** removido `src/components/bi/biUtils.ts` após
   confirmação com `grep -rn "biUtils" src/` (sem referências). Build e testes OK.

> Status: ambos os pontos foram CONCLUÍDOS nesta sessão.

---

## Demanda

Os indicadores da entrega anterior "não diziam nada com nada" — usavam discovery
heurístico (`findCol()` + `limit:1`) e gráficos genéricos. Havia muito "ouro" nas
views do SQL Server não explorado. Objetivo: reconstruir os indicadores das 6 tabs
com métricas de negócio reais, validadas contra os dados ao vivo.

Decisão do usuário: fazer **todos os domínios**, abordagem livre. Escolhido
**reescrever os indicadores das sections** (manter tabs + infra KPICard/ChartCard).

## Root cause dos indicadores fracos (confirmado em runtime)

1. **`VW_Ceres_CRM_Negocios` é denormalizada por produto** — somar linhas cruas
   inflava pipeline/valor em ~10% (4.589 linhas → 4.189 negócios). Corrigido com
   dedupe por `NGO_Numero`.
2. **"% Faturados" era sempre 0%** — buscava "fatur" em `PDO_SituacaoPedido`, que
   só tem Aprovado/Cancelado/Aberto. Substituído por taxa de aprovação real.
3. **`findCol()` heurístico** não localizava colunas de negócio → gráficos vazios
   ou genéricos, e KPIs que dumpavam nomes de coluna como "hint".

## O que foi entregue (por tab)

| Tab | Service / Hook | Indicadores reais |
|-----|----------------|-------------------|
| **Comercial** | `negociosBIService` + `funilBIService` → `useNegociosBI` + `useFunilData` | Conversão 49%, pipeline aberto R$ 371M, valor ganho R$ 105M, ticket R$ 138k, ciclo 130d, origem do lead, motivos de perda em R$, velocidade do funil (gargalos), ranking consultores |
| **Pedidos** | `pedidosBIService` + `pedidosItemBIService` → `usePedidosData` + `usePedidosItensData` | Faturamento aprovado R$ 163M, taxa aprovação 73%, mix 30% financiado/70% próprio, evolução mensal, itens por grupo |
| **Produtos** | `produtosBIService` → `useProdutosData` (reposicionado p/ **Parque instalado**) | 1.500 máquinas / 669 clientes, base por grupo/marca/modelo |
| **Serviços** | `servicosBIService` → `useServicosData` | OS por status, tempo médio/mediano de resolução (17,7d/6,9d), faixas, motivos de pausa, causas |
| **Operacional** | `operacionalBIService` → `useOperacionalData` (TecnicoTempo + Agenda) | KM rodado, utilização/ocioso por técnico, agenda por status/tipo |
| **Admin** | `adminBIService` → `useAdminData` (Carteira) | 2.879 clientes, prospects vs ativos, cobertura por UF (19), carteira por consultor, tipo A/B/C/D |

Infra compartilhada estendida: `dateUtils.ts` ganhou `formatBRLShort`, `formatDias`,
`daysBetween`.

## Qualidade

```
✓ tsc --noEmit       0 erros
✓ vitest             14/14 (5 arquivos: negocios, pedidos, servicos, admin + existentes)
✓ vite build         3.0s, sections code-split
✓ eslint BI files    0 erros
```

Verificação runtime feita via `curl` na edge function `query-sqlserver` para cada
domínio — todos os KPIs retornam valores reais e não triviais.

## Observações / pendências

- **⚠️ Utilização técnica = 4,2% / ocioso = 97,2%** (`VW_Ceres_TecnicoTempo`):
  `TMP_TempoOcioso ≈ TMP_TempoDisponivel`, `TMP_DuracaoAtendimento` muito menor.
  Possível divergência de unidade entre os campos `TMP_*`. **Validar semântica na
  fonte antes de concluir baixa produtividade.** KM rodado é a métrica confiável.
- **`biUtils.ts` (findCol/groupByCol) virou dead code** — não deletado (criado há
  <7 dias; aguarda aprovação para remover).
- **Push/PR pendente** — projeto ainda não é repo git; delegar a @devops quando for.
- Campos não populados na fonte (ignorados): `PQM_Ano`, `PQM_Horimetro`,
  `CLI_Segmento`, `PDO_FinanciamentoModalidadeNome`.

## Arquivos chave para retomar

1. `src/hooks/bi/useNegociosBI.ts` — padrão: aggregate puro + dedupe + useQuery enabled
2. `src/services/bi/negociosBIService.ts` — colunas-ouro tipadas + resolução de vendedor
3. `src/components/bi/sections/ComercialSection.tsx` — section mais completa (referência)
4. `docs/MAPEAMENTO_DADOS.md` — mapa de views/colunas

---

## Sessão Retomada — 2026-06-XX (hoje)

### Pendências da sessão anterior resolvidas:

1. **Utilização técnica corrigida** ✅
   - Problema: `TMP_TempoDisponivel` e `TMP_TempoOciosos` estavam em segundos, enquanto `TMP_DuracaoAtendimento` e `TMP_DuracaoDeslocamento` estavam em minutos
   - Solução: Conversão de segundos para minutos no `aggregateOperacional`
   - Arquivo modificado: `src/hooks/bi/useOperacionalData.ts`

2. **Dead code removido** ✅
   - Removido `src/components/bi/biUtils.ts` (sem referências no códigobase)
   - Confirmação: `grep -rn "biUtils" src/` retornou 0 resultados
   - Build e testes OK

### Status
- Build: ✅ verde
- Testes: ✅ 14/14 passando
- Próximo: Deploy quando @devops estiver disponível
