# UX-DesperdicioV2 — Redesenho da visualizacao de Desperdicio em /bi/acoes

**Story:** 3-A do PRD-AcoesCorrecoesV10.md
**Status:** Proposta UX
**Autor:** @ux (Uma)
**Data:** 2026-08-26

---

## 1. Diagnostico visual do DesperdicioTable atual

O `DesperdicioTable` em `AcoesGestaoCarteiraTables.tsx:64-91` apresenta tres problemas concretos que impedem a comunicacao eficaz do conceito:

### Problema 1: Razao visitas/oportunidades sem escala visual
A coluna `visitasPorOportunidade` e renderizada apenas como texto num formato suave (`${TD_SOFT} tabular-nums`). O numero 25 e 2 tem pesos visuais identicos. O gestor nao consegue identificar de relance quem e o maior desperdicio sem ler cada linha.

**Referencia de codigo atual:**
```typescript
// Linha 86 — sem InlineBar, sem cor por faixa, sem destaque
<td className={`${TD_SOFT} tabular-nums`}>{fmtRatio(r.visitasPorOportunidade)}</td>
```

### Problema 2: NULLs (sem nenhuma oportunidade) invisiveis
Clientes com `oportunidades === 0` geram `visitasPorOportunidade = NULL`. O `fmtRatio` transforma isso em um traco `—`. O pior caso — cliente com muitas visitas e zero oportunidade — aparece identico a qualquer outra linha exceto pela ausencia do numero.

**Contraste com ClienteTable em AcoesEsforcoRetorno.tsx:187:**
```typescript
const isAlert = r.oportunidades === 0 && r.visitas >= 10;
```
Essa logica de alerta JA EXISTE no mesmo codebase, mas nao foi portada para `DesperdicioTable`.

### Problema 3: Ausencia de ranking e hierarquia
A tabela atual lista clientes sem ordenacao visivelmente priorizada. O `ClienteTable` de `AcoesEsforcoRetorno.tsx` ja implementa ranking com `#` posicional e InlineBar — o mesmo padrao falta aqui.

---

## 2. Opcoes de redesign

### Opcao A: Tabela com Indice de Desperdicio escalonado

Mantem a estrutura de tabela, adiciona coluna "Indice" com InlineBar e badge de severidade.

| | Prós | Contras |
|---|---|---|
| Conservador | Mudanca minima, fácil implementacao | Ainda e tabela — menos escaneavel que ranking |
| Familiar | Usuario ja conhece o formato | Não resolve o problema de legibilidade da razao |
| Baixo risco | Sem quebra de layout | Não se destaca das outras tabelas |

### Opcao B: Ranking horizontal com InlineBar (estilo ClienteTable)

Substitui a tabela por ranking ordenado por `visitasPorOportunidade DESC`, com InlineBar por linha.

| | Prós | Contras |
|---|---|---|
| Escaneável | Maior destaque visual, posicao # clara | Afasta do padrão tabela existente |
| Padrão VOUX | Ja usado em `AcoesEsforcoRetorno.tsx` | Pode parecer repetitivo se não houver variacao |
| NULL destacado | Casos graves (zero oportunidades) com badge de alerta | Exige lógica adicional para NULL ordering |

### Opcao C: Hibrida — KPIs de contexto + top 10 com InlineBar

Header com 3 mini-KPIs (total desperdicio, % da carteira, cidade mais afetada) + lista compacta top 10.

| | Prós | Contras |
|---|---|---|
| Contexto | Gestor entende a magnitude antes de mergulhar | Mais componentes para implementar |
| Acao | Top 10 foca a atenção nos piores casos | Pode perder granularidade para usuarios que precisam da lista completa |
| Storytelling | Transforma numero em narrativa | Exige computar KPIs derivados (nao vem na RPC) |

### Opcao D: Tabela de alertas com InlineBar + expansao (RECOMENDADA)

Mantem estrutura de tabela mas com tres mudancas direcionadas:
1. Coluna "Gravidade" com InlineBar escalonada (referencia: `visitasPorOportunidade` ou contagem direta)
2. Badge de alerta para `oportunidades === 0` (portando a logica de `ClienteTable`)
3. Ordenacao padrao por `visitasPorOportunidade DESC`, NULL primeiro

| | Prós | Contras |
|---|---|---|
| Familiar | Mantem o formato tabela que o usuario ja conhece | Pode parecer incremental demais |
| Padrao VOUX | InlineBar ja existe no projeto | - |
| NULL destacado | Casos graves com badge de alerta | - |
| Escalavel | Funciona com paginação existente | - |

---

## 3. Recomendacao

**Opcao D** — Tabela de alertas com InlineBar.

Justificativa: O conceito de "desperdicio" ja esta correto. O problema e de execucao visual, nao de arquitetura. A Opcao D porta solucoes ja testadas (`isAlert` de `ClienteTable`, `InlineBar` de `AcoesEsforcoRetorno.tsx`) para o contexto onde faltam. Mantem a estrutura de tabela que nao quebra a expectativa do usuario, adiciona a hierarquia visual que comunica severity, e destaca os NULLs (caso mais grave). A implementacao e minima comparada a Opcao C, sem demanda de KPIs derivados.

---

## 4. Wireframe ASCII da Opcao D

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  GESTAO DE CARTEIRA — Desperdicio                               [Search...]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  # │ Cliente                    │ Cidade      │ Visitas │ Oport. │ Gravidade  │
├────┼────────────────────────────┼─────────────┼─────────┼────────┼────────────┤
│  1 │ Supermercado Central       │ Sao Paulo   │    47   │    0   │ ███████████│
│    │  [!] SEM OPORTUNIDADE      │             │         │        │            │
├────┼────────────────────────────┼─────────────┼─────────┼────────┼────────────┤
│  2 │ Restaurante Sabor da Terra  │ Campinas    │    38   │    0   │ █████████░ │
│    │  [!] SEM OPORTUNIDADE      │             │         │        │            │
├────┼────────────────────────────┼─────────────┼─────────┼────────┼────────────┤
│  3 │ Academia Corp             │ Sao Paulo   │    25   │    1   │ ████████░░ │
│    │                            │             │         │        │ 25.0/oport │
├────┼────────────────────────────┼─────────────┼─────────┼────────┼────────────┤
│ .. │                            │             │         │        │            │
├────┼────────────────────────────┼─────────────┼─────────┼────────┼────────────┤
│ 48 │ Hotel Mountain View        │ Serra Negra │     8   │    1   │ ████░░░░░░ │
│    │                            │             │         │        │  8.0/oport │
├────┴────────────────────────────┴─────────────┴─────────┴────────┴────────────┤
│  Pagina 1 de 3   [<] [1] [2] [3] [>]                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Legenda visual:**
- `█████` = InlineBar com cor danger (champagne→terracota conforme gravidade)
- `[!] SEM OPORTUNIDADE` = badge vermelho com icon (aparece APENAS quando `oportunidades === 0`)
- `#` = posicao no ranking
- NULL em `visitasPorOportunidade` resulta em barra cheia + badge de alerta

**Tokens VOUX aplicados:**
- Background alerta: `bg-[color-mix(in_oklch,var(--voux-danger)_8%,transparent)]`
- Badge perigo: `text-[var(--voux-danger)]`
- InlineBar fill: `var(--voux-terracota)` para graves, `var(--voux-champagne)` para moderados
- Header: `bg-[var(--voux-card-from)]`, `text-[var(--voux-text-muted)]`
- Zebra row: `bg-foreground/[0.02]`

---

## 5. Criterios de aceite (@dev)

| #  | Criterio | Tipo | Verificacao |
|----|----------|------|-------------|
| 1  | NULL em `visitasPorOportunidade` exibe barra CHEIA (100%) + badge `[!] SEM OPORTUNIDADE` em vermelho | Binario | Inspecionar DOM: badge presente quando `oportunidades === 0` |
| 2  | InlineBar visible para todas as linhas, com largura proporcional ao max da pagina | Binario | Barra renderiza com width > 0px em qualquer linha |
| 3  | Ordenacao padrao: NULL primeiro, depois `visitasPorOportunidade DESC` | Binario | Primeira linha da primeira pagina tem `oportunidades === 0` quando existir tal registro |
| 4  | Alerta visual (background vermelho sutil) em linhas com `oportunidades === 0 && visitas >= 10` | Binario | Linha com 10+ visitas e 0 oport. tem `bg-danger-8pct` |
| 5  | Search client-side filtra as linhas visiveis da pagina atual (comportamento existente) | Binario | Digitar nome de cliente existente mostra apenas ele; digitar nome inexistente mostra empty state |
| 6  | Paginacao numerada mantida: PAGE_SIZE=50, controles [1] [2] [3] com navegacao | Binario | Controles renderizam, pagina 2 carrega 50下一页 |
| 7  | `visitasPorOportunidade = 0` (zero, nao NULL) exibe InlineBar em 0% com badge? | Decide | **Pendente:** se `visitas > 0 && oportunidades > 0` mas a razao arredonda para 0, e diferente de NULL. Recomendacao: NULL = badge, 0 = barra vazia sem badge |

---

## 6. Edge cases

### NULL em `visitasPorOportunidade`
- **O que significa:** `oportunidades === 0` (nenhuma oportunidade levantada)
- **Destaque:** badge vermelho `[!] SEM OPORTUNIDADE` + InlineBar 100%
- **Posicionamento:** linha inteira com background danger sutil (`8% opacity`)
- **Ordenacao:** NULLs aparecem primeiro (pior caso)

### `visitas = 0`
- **O que significa:** cliente inativo, nao desperdicado
- **tratamento:** cliente com `visitas === 0` NAO deveria aparecer na lista `desperdicio` — desperdicio requer atividade sem retorno. Se aparecer, filtrar no backend (RPC) OU filtrar na UI (remover da renderizacao)
- **Decisao:** verificar com @data-engineer se a RPC ja filtra `visitas > 0`. Se nao, pedir novo filtro na RPC.

### `visitas > 0 && oportunidades > 0 && visitasPorOportunidade === 0` (arredondamento)
- Raro (requer visitas < oportunidades, contra-intuitivo para desperdicio)
- InlineBar 0%, sem badge, ordenar porultimo

### `cidade = NULL`
- Exibir `—` (DASH) conforme padrao existente

---

## 7. Compatibilidade

### Paginacao server-side
- Mantida integralmente via `useAcoesGestaoListasRpc` com `tipo: "desperdicio"`
- PAGE_SIZE=50 inalterado
- Ordenacao: a ser definida se NULL-first requer mudanca na RPC (verificar com @data-engineer se a SQL atual ja ordena `NULLS FIRST`)

### Search client-side
- Search existente (`p_search` no hook) opera sobre `cliente` e `cidade`
- Filtra linhas ja recebidas da pagina atual
- Mantido: nenhuma mudanca necessaria

### Contexto de filtros
- Compartilhado via `NegociosFilterContext`
- Periodo, vendedor, cidade afetam a query
- Mantido: nenhuma mudanca necessaria

---

## 8. Referencias de implementacao no codebase

| Padrao | Arquivo | Linha |
|--------|---------|-------|
| InlineBar | `AcoesEsforcoRetorno.tsx` | 146, 201 |
| isAlert logic | `AcoesEsforcoRetorno.tsx` | 132, 187 |
| Badge de alerta | `AcoesEsforcoRetorno.tsx` | 140, 195 |
| BiTableCard wrapper | `AcoesEsforcoRetorno.tsx` | 58-94 |
| DASH formatter | `acoesGestaoUtils.ts` | `DASH` |
| fmtRatio | `acoesGestaoUtils.ts` | `fmtRatio` |
| Tokens danger | CSS vars | `--voux-danger` |
| Tokens champagne | CSS vars | `--voux-champagne` |
| Zebra row | `AcoesGestaoCarteiraTables.tsx` | 18-20 |

---

## 9. Proximos passos

1. @dev: Implementar Opcao D conforme wireframe e criterios
2. @qa: Validar os 7 criterios de aceite (Tabela 5)
3. @pm: Decidir edge case `visitas = 0` (filtrar na RPC ou UI?)
4. @data-engineer: Verificar ordenacao NULL-first na RPC `desperdicio`
