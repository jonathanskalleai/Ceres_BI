# PRD — /bi/acoes: Correções de Visual e Comportamento (v10)

**Versão:** 1.0
**Data:** 2026-08-02
**Autor:** @pm (Morgan)
**Status:** Draft — aguardando validação do squad
**Epic de referência:** `EPIC-ACOES-VISUAL-CORRECTIONS`

---

## Contexto

A tela `/bi/acoes` v9/v6 foi validada pelo cliente em julho/2026. Durante análise
posterior, 5 desvios de comportamento foram identificados: 2 de consistência visual
e 3 de semântica de dados. Este documento consolida todos em épicos e stories
com critérios de aceite mensuráveis.

> **Regra absoluta: o contrato de três fontes (ações / pedidos / negócios) documentado
> em `docs/features/acoes-bi.md` NÃO é alterado por nenhuma das 5 stories. Cada story
> descreve comportamento observável novo dentro das fontes existentes.**

---

## Glossário

| Termo | Definição |
|---|---|
| AÇÃO | Linha de `mirror.crm_acoes` — atividade do CRM |
| PEDIDO | Linha de `mirror.crm_pedidos` com `pdo_situacaopedido = 'Aprovado'` |
| NEGÓCIO | Linha de `mirror.crm_negocios` canonizado |
| GANHO | PEDIDO aprovado + negócio canonico `ngo_conclusao = 'Ganho'` |
| PERDIDO | NEGÓCIO canonico com `ngo_conclusao = 'Perdido'` |
| EM ANDAMENTO | NEGÓCIO canonico com `ngo_conclusao = 'Em Andamento'` |

---

## ÉPICO 1 — Consistência visual do bloco "Atividade e desfechos do periodo"

**Problema:** Visitas e Oportunidades usam Degrau (barra larga com gradiente, ícone e
número). Ganhos e Perdidos usam cards estilisticamente diferentes. O usuário exige
o mesmo formato para os quatro indicadores.

**Arquivos afetados:**
- `src/components/bi/sections/AcoesFunilConversao.tsx` (185 ln — EXTENSÃO PROIBIDA)
- `src/components/bi/sections/AcoesDesfechosPeriodo.tsx` (114 ln — REESCRITA)
- `src/components/bi/charts/primitives/SvgBarV.tsx` (já suporta `barColors`)

---

### Story 1-A: Unificar formato visual de Ganhos e Perdidos

**Status:** Draft
**Epic:** EPIC-ACOES-VISUAL-CORRECTIONS
**Prioridade:** Alta
**Complexidade:** Média — estilo, não lógica

#### Descrição

Ganhos e Perdidos devem usar o mesmo componente visual "Degrau" (barra larga com
gradiente, ícone SVG, número e label) usado por Visitas e Oportunidades. A diferença
visual entre os quatro indicadores fica exclusivamente na cor: degrau de atividade
(gradient champagne), Ganho (verde success), Perdido (vermelho danger). Os quatro
formam uma composição lado a lado, dentro do mesmo espaço hoje ocupado por Degrau →
Degrau + dois cards.

#### Comportamento esperado

- Os 4 indicadores renderizam como barras largas horizontais ( Degrau), lado a
  lado em grid 2x2 no mobile e 1x4 no desktop.
- Cada barra mostra: ícone + número + label + hint (fonte) no hover.
- Ganhos: cor `var(--voux-success)`, ícone Trophy.
- Perdidos: cor `var(--voux-danger)`, ícone XCircle.
- Visitas e Oportunidades: gradiente champagne (inalterado).
- Largura relativa de cada barra: mesmo algoritmo de `larguraPct` usado hoje.
- A nota `role="note"` do período permanece abaixo dos 4 degraus.
- O footer explicativo (paralelos, não funil, etc.) permanece inalterado.

#### Edge cases

- Se `funil.ganhos = 0`: barra ocupa largura mínima (18%, como Degrau atual).
- Se `funil.perdidos = 0`: mesma regra.
- Valores extremos (ex: 0 vs 10.000): a legenda `diasParado` e hints
  cabem no overflow sem quebrar — testar com string longa de fonte.

#### Dados de entrada (funil)

```typescript
interface AcoesFunil {
  visitas: number;
  oportunidades: number;
  valorOportunidades: number;
  ganhos: number;
  perdidos: number;
  valorPerdido: number;
}
```

#### Dados de saída

4 barras visuais + hint tooltip em cada uma com a fonte técnica.

#### Critérios de aceite

- [ ] AC1: Given `/bi/acoes` com dado de julho/2026, When a seção carrega,
      Then os 4 indicadores (visitas, oportunidades, ganhos, perdidos) renderizam
      como barra larga com ícone + número + label — visualmente idêntico exceto cor.
- [ ] AC2: Given qualquer janela com `ganhos = 0`, When a seção carrega,
      Then a barra de Ganhos ocupa pelo menos 18% da largura (não some).
- [ ] AC3: Given qualquer janela com `perdidos = 0`, When a seção carrega,
      Then a barra de Perdidos ocupa pelo menos 18% da largura (não some).
- [ ] AC4: Given hover sobre a barra de Ganhos, When tooltip aparece,
      Then o hint declara "crm_pedidos · data de aprovacao do pedido · R$ de pedido"
      (fonte exata inalterada).
- [ ] AC5: Given hover sobre a barra de Perdidos, When tooltip aparece,
      Then o hint declara "crm_negocios · data de fechamento do negocio · R$ negociado (potencial)".
- [ ] AC6: Given AcoesFunilConversao.tsx, When story implementada,
      Then o arquivo mantém ≤ 200 linhas (regra coding-standards #4).
      Sugestão: extrair os Degraus para `AcoesDegrauBar.tsx` se necessário.

#### Risco

- **DRY:** o componente Degrau já existe em `AcoesFunilConversao.tsx`. Extrair para
  componente reutilizável antes de duplicar. Nome sugerido: `AcoesDegrauBar`.
- **Regressão "Em aberto" do card (julho/2026):** a mudança é puramente visual,
  não toca dados — risco de regressão funcional = baixo.
- **Monolito > 300 linhas:** `AcoesDesfechosPeriodo.tsx` será esvaziado (os dois
  cards viram Degraus). Se o arquivo não cair para ≤ 50 linhas após a refatoração,
  considerá-lo para deleção e mover qualquer lógica residual para o caller.

---

## ÉPICO 2 — Gestão de Carteira: remover "Sem Contato"

**Problema:** 8 mil registros na lista, UI mostra 5 por página — utilidade prática
inexistente. Decisão explícita: remoção total.

**Arquivos afetados:**
- `src/components/bi/sections/AcoesGestaoCarteira.tsx` — remove aba `sem_contato` de `TABS`
- `src/components/bi/sections/AcoesGestaoCarteiraSummary.tsx` — DELETAR
- `src/components/bi/sections/AcoesGestaoCarteiraTables.tsx` — mantém `SemContatoTable`
  exportado? Verificar se há outro consumidor antes de deletar.
- `src/hooks/bi/useAcoesGestaoListasRpc.ts` — remove chamada de `sem_contato`
- `src/types/biRpc.ts` — remove `AcoesSemContatoRow` se órfão

---

### Story 2-A: Remover aba "Sem Contato" de Gestão de Carteira

**Status:** Draft
**Epic:** EPIC-ACOES-VISUAL-CORRECTIONS
**Prioridade:** Alta
**Complexidade:** Baixa — remoção pura

#### Descrição

Remove a aba "Sem Contato" do bloco Gestão de Carteira e o mini-card top-3 que a
precede. Mantém "Desperdício" e "Negativas". A legenda contextual abaixo das abas
muda para refletir apenas as duas listas restantes.

#### Comportamento esperado

- `AcoesGestaoCarteira.tsx`: `TABS` contém apenas `desperdicio` e `negativas`.
- `AcoesGestaoCarteiraSummary.tsx`: DELETADO (sem replacement — decisão do usuário).
- `AcoesGestaoCarteiraTables.tsx`: `SemContatoTable` exportado e usado exclusivamente
  neste consumer? Verificar com grep antes de deletar o componente.
- Legenda contextual (`legenda` useMemo) reescrita para só duas branches.
- A prop `drill?: CarteiraDrill` — o drill-down do chart "Clientes em Risco" apontava
  para a aba sem_contato. Decisão: o drill é desabilitado quando sem_contato some?
  Recomendação PM: desabilitar drill-badge completamente (o chart "Clientes em
  Risco" segue existindo, mas o clique que abria a aba sem_contato perde destino).
- O gráfico "Clientes em Risco" permanece inalterado.

#### Edge cases

- Se o drill-down do chart "Clientes em Risco" estiver ativo quando a aba sem_contato
  some: o componente deve remover o drill silenciosamente (sem erro, sem badge).
- A prop `drill` permanece no type por ora (pode ser reutilizada no futuro para
  "desperdício" ou "negativas").

#### Critérios de aceite

- [ ] AC1: Given `/bi/acoes`, When o bloco Gestão de Carteira carrega,
      Then há exatamente 2 abas: "Desperdício" e "Negativas" — "Sem Contato" ausenta.
- [ ] AC2: Given `/bi/acoes`, When o bloco carrega,
      Then o mini-card top-3 "sem contato" NÃO é renderizado (seção anterior null).
- [ ] AC3: Given `/bi/acoes` com drill-down ativo de uma versão anterior,
      When o bloco carrega, Then nenhum badge de filtro de faixa aparece
      (drill silenciosamente ignorado, sem erro).
- [ ] AC4: Given a tab "Desperdício", When ativa, Then a legenda explica a regra
      de desperdício (inalterada, já existia).
- [ ] AC5: Given `npm run build`, When executado, Then sucesso sem erro TS
      (nenhum import órfão de `SemContatoRow` ou `AcoesGestaoCarteiraSummary`).

#### Risco

- **Regressão drill-down:** chart "Clientes em Risco" pode manter clique drill-down
  que agora não faz nada. Decisão: remover capability de drill se não houver
  destino; ou adaptar para drill em "desperdício" (futuro).
- **Import órfão:** `AcoesSemContatoRow` pode ainda ser importado em outro lugar.
  Verificar com grep antes de editar tipos.
- **Dead code de hook:** `useAcoesGestaoListasRpc` ainda será chamado para
  `desperdicio` e `negativas` — chamadas de `sem_contato` removidas apenas
  neste componente, não em outros consumers.

---

## ÉPICO 3 — Gestão de Carteira: repensar visualização de "Desperdício"

**Problema:** conceito ok, formato de exibição não agrada. Requer redesign
de UX — não mudança de dados.

**Arquivos afetados:**
- `src/components/bi/sections/AcoesGestaoCarteiraTables.tsx` (`DesperdicioTable`)
- `src/hooks/bi/useAcoesGestaoListasRpc.ts` (dados inalterados — mesma RPC)
- Possivelmente: novo componente em `src/components/bi/sections/`

---

### Story 3-A: Repensar visualização de "Desperdício"

**Status:** Draft
**Epic:** EPIC-ACOES-VISUAL-CORRECTIONS
**Prioridade:** Média
**Complexidade:** Média — UX/design, não dados

#### Descrição

O conceito de "desperdício" (clientes com muitas visitas mas nenhuma ou poucas
oportunidades geradas) é válido. O formato atual não comunica bem o conceito.
Redesenhar a visualização para que o gestor identifique rapidamente:
(1) quem desperdiçou esforço, (2) quanto esforço foi investido vs. retorno.

#### Comportamento esperado

**Pendência de UX:** Esta story requer input de `@ux` antes de implementação.
O PM define o espaço de solução, não a forma final. Opções a considerar:

- Indicador de relação visitas/oportunidades (já está nos dados via `rpc_acoes_gestao_listas`)
- Destaque visual para o.top N piores relações
- Formato de tabela diferente (coluna de "índice de desperdício" vs. só ordenação)
- Filtro: "esforço >= X visitas, resultado < Y oportunidades"

#### Input obrigatório antes de implementação

- [ ] `@ux` precisa propor redesign e validar com demand owner antes de dev
- [ ] A RPC `rpc_acoes_gestao_listas('desperdicio')` não muda — os dados já existem
- [ ] Nova visualização não pode quebrar paginação server-side existente

#### Critérios de aceite

- [ ] AC1: Given `/bi/acoes` com a aba "Desperdício" ativa,
      Then a visualização comunuca o conceito de "esforço sem retorno"
      de forma mais clara que a tabela atual (validação visual com o demand owner).
- [ ] AC2: Given mesma query de RPC (desperdicio), When nova visualização renderiza,
      Then todos os dados da RPC são exibidos corretamente (nenhum omitido).
- [ ] AC3: Given paginação server-side, When o gestor navega entre páginas,
      Then os dados corretos são carregados por página (não quebra paginação).
- [ ] AC4: Given `npm run build`, When executado, Then sucesso sem erro TS.

#### Risco

- **Dead end UX:** se `@ux` não validar redesign a tempo, esta story fica em
  BLOCKED até a próxima iteração — não bloquear as outras 4.
- **RPC inalterada:** se a RPC precisar de novo campo (ex: índice calculado),
  adicioná-lo via migration nova — não mudar lógica existente.

---

## ÉPICO 4 — Drill-down de Ganho/Perdido: listar PEDIDOS e NEGÓCIOS, não ações

**Problema:** ao clicar no chip "Ganho" ou "Perdido", a tabela detalhe mostra ações.
Deveria mostrar, respectivamente, PEDIDOS (aprovados) e NEGÓCIOS (perdidos).

**Arquivos afetados:**
- `src/components/bi/sections/AcoesDetailWithFilter.tsx` (reescrever comportamento de drill)
- `src/components/bi/sections/AcoesSection.tsx` (caller — decide qual tabela renderizar)
- `src/components/bi/AcoesDetailTable.tsx` (tabela de ações — substituída por novas para Ganho/Perdido)
- `src/components/bi/AcoesPedidosTable.tsx` (NOVO — tabela de pedidos aprovados)
- `src/components/bi/AcoesNegociosTable.tsx` (NOVO — tabela de negócios perdidos)
- `src/hooks/bi/useAcoesDetalheRpc.ts` (inalterado — filtra ações)
- `src/services/biRpcService.ts` (possível novo fetch: `fetchPedidosBI` ou extensão de `fetchAcoesDetalhe` com novo `p_tipo`)
- `src/hooks/bi/usePedidosBiRpc.ts` (NOVO)
- `src/hooks/bi/useNegociosPerdidosRpc.ts` (NOVO)
- `src/types/biRpc.ts` (novos tipos: `PedidoDetalheRow`, `NegocioPerdidoRow`)

---

### Story 4-A: Drill-down de "Ganho" mostra PEDIDOS aprovados

**Status:** Draft
**Epic:** EPIC-ACoes-VISUAL-CORRECTIONS
**Prioridade:** Alta
**Complexidade:** Alta — nova RPC ou extensão de RPC existente + nova UI

#### Descrição

Quando o gestor clica no chip "Ganho" na seção de filtros de status, a tabela
abaixo deve listar PEDIDOS aprovados (não ações). Cada linha mostra: número do
pedido, cliente, consultor, data de aprovação, valor do pedido, situação.

#### Dados de entrada

**Fonte:** `mirror.crm_pedidos` + `mirror.crm_negocios` (join canônico)

```typescript
interface PedidoDetalheRow {
  pedidoId: string;        // pdo_codigointerno
  cliente: string;        // via JOIN crm_negocios → crm_carteira_clientes
  consultor: string;      // ngo_vendedores → usuarios.usr_nomeusuario
  dataAprovacao: string;  // pdo_dthaprovacao (date)
  valorPedido: number;    // pdo_vlrpedido
  status: string;         // 'Aprovado'
  negocioNumero: string;  // ngo_numero (link de volta)
  cidade: string;         // fn_cli_cidade
}
```

**Filtros herdados:** vendedor, cidade, período (from/to aplicados a `pdo_dthaprovacao`)

#### Comportamento esperado

- Chip "Ganho" ativo → renderiza `AcoesPedidosTable` (nova).
- Colunas: Nº Pedido | Cliente | Cidade | Consultor | Data Aprovação | Valor.
- Ordenação: por data de aprovação DESC (mais recente primeiro).
- Paginção server-side (PAGE_SIZE = 50, `PaginationControls`, reutilizar).
- Badge de contexto: "Mostrando pedidos aprovados — fontes: crm_pedidos + crm_negocios."
- Search box client-side (mesmo padrão de `AcoesDetailTable`).
- Quando切换 de "Ganho" para outro status → tabela de ações retorna
  (comportamento inalterado para "Todos" e "Em Aberto").

#### Edge cases

- Pedido aprovado mas negócio sem `ngo_vendedores` mapeável:
  consultor aparece como "—" (não quebra — já existe no padrão).
- Período sem pedidos aprovados: tabela vazia com mensagem "Nenhum pedido
  aprovado neste período."
- O período é o mesmo seletor de `/bi/acoes`: `pdo_dthaprovacao` entra no filtro
  de período — isso é consistente com o card "Valor Ganho" (contrato das três fontes).

#### Critérios de aceite

- [ ] AC1: Given `/bi/acoes`, When o gestor clica no chip "Ganho",
      Then a tabela abaixo lista PEDIDOS aprovados (não ações), com as colunas
      Nº Pedido | Cliente | Cidade | Consultor | Data Aprovação | Valor.
- [ ] AC2: Given chip "Ganho" ativo, When o gestor navega entre páginas,
      Then `PaginationControls` funciona corretamente com contagem server-side.
- [ ] AC3: Given chip "Ganho" ativo, When o gestor busca por nome de cliente,
      Then a busca filtra client-side DENTRO da página atual (sem round-trip).
- [ ] AC4: Given chip "Ganho" ativo e janela julho/2026,
      Then o total de linhas da tabela é consistente com o número de ganhos
      exibido no card "Valor Ganho" (dedup por `pdo_codigointerno`).
- [ ] AC5: Given切换 de "Ganho" para "Todos", When chip clicado,
      Then a tabela de ações original volta a renderizar (regressão zero).
- [ ] AC6: Given `npm run build`, When executado, Then sucesso.

#### Risco

- **Nova RPC ou extensão:** a solução mais DRY é criar `rpc_acoes_pedidos_ganhos`
  (paralela a `rpc_acoes_detalhe` que é ações). Alternativa: parametrizar
  `rpc_acoes_detalhe` com `p_tipo = 'pedidos'` — mas a lógica de dedup é diferente
  (por `pdo_codigointerno` vs. `ngo_nronegocio`). @dev decide, mas a recomendação
  PM é RPC separada para manter isolamento de contrato.
- **Contrato de três fontes:** a data de competência de Ganho é `pdo_dthaprovacao`.
  A tabela de pedidos usa esse filtro — não `ngo_datafechamento`. Isso é correto
  e consistente com o card existente.
- **Monolito > 300 linhas:** `AcoesPedidosTable.tsx` não pode passar de 150 linhas.
  Manter estrutura mínima: wrapper `BiTableCard` + `<table>` + `PaginationControls`.

---

### Story 4-B: Drill-down de "Perdido" mostra NEGÓCIOS perdidos

**Status:** Draft
**Epic:** EPIC-ACoes-VISUAL-CORRECTIONS
**Prioridade:** Alta
**Complexidade:** Alta — nova RPC + nova UI

#### Descrição

Quando o gestor clica no chip "Perdido", a tabela abaixo lista NEGÓCIOS perdidos
(não ações). Cada linha mostra: número do negócio, cliente, consultor, data de
fechamento, valor negociado, motivo/observação se disponível.

#### Dados de entrada

**Fonte:** `mirror.crm_negocios` canonizado + `mirror.crm_carteira_clientes`

```typescript
interface NegocioPerdidoRow {
  negocioNumero: string;  // ngo_numero
  cliente: string;        // via JOIN
  cidade: string;         // fn_cli_cidade
  consultor: string;      // ngo_vendedores → usuarios.usr_nomeusuario
  dataFechamento: string; // ngo_datafechamento (date)
  valorNegociado: number;  // ngo_vlrtotalnegociado
  conclusao: 'Perdido';   // literal
  funil?: string;         // ngo_funil (para debug, não exibir por padrão)
}
```

**Filtros herdados:** vendedor, cidade, período (from/to aplicados a `ngo_datafechamento`)

#### Comportamento esperado

- Chip "Perdido" ativo → renderiza `AcoesNegociosTable` (nova).
- Colunas: Nº Negócio | Cliente | Cidade | Consultor | Data Fechamento | Valor.
- Ordenação: por data de fechamento DESC.
- Paginção server-side (PAGE_SIZE = 50, reutilizar `PaginationControls`).
- Badge de contexto: "Mostrando negócios perdidos — fonte: crm_negocios · ngo_datafechamento."
- Search client-side.
- Exclui `ngo_funil = 'REPASSE DE MAQUINA'`.

#### Critérios de aceite

- [ ] AC1: Given `/bi/acoes`, When o gestor clica no chip "Perdido",
      Then a tabela abaixo lista NEGÓCIOS perdidos, com as colunas
      Nº Negócio | Cliente | Cidade | Consultor | Data Fechamento | Valor.
- [ ] AC2: Given chip "Perdido" ativo e janela julho/2026,
      Then o total de linhas é consistente com `funil.perdidos` do funil
      (7 negócios / R$ 1.060.000,00 — valor de referência da validação).
- [ ] AC3: Given chip "Perdido" ativo, When o gestor navega entre páginas,
      Then `PaginationControls` funciona corretamente.
- [ ] AC4: Given chip "Perdido" ativo e `ngo_funil = 'REPASSE DE MAQUINA'`,
      Then esse negócio NÃO aparece na tabela (exclusão aplicada na RPC).
- [ ] AC5: Given切换 de "Perdido" para outro status, When chip clicado,
      Then regressão zero (ações ou pedidos exibidos corretamente).

#### Risco

- **Mesma estrutura de 4-A:** criar RPC `rpc_acoes_negocios_perdidos`
  (paralela). Padrão idêntico a `rpc_acoes_pedidos_ganhos`.
- **Contrato de três fontes:** `ngo_datafechamento` é a data de competência de
  Perdido — confirmar que não é `ngo_datacadastro` nem `ngo_dataatualizacao`
  (contrato verificado na doc: "ngo_dataatualizacao nunca define indicador").
- **Dead code potencial:** se a tabela de ações (`AcoesDetailTable`) não for
  mais usada para Ganho/Perdido, verificar se ainda é usada para "Todos" e
  "Em Aberto" — se sim, manter; se não, avaliar remoção.

---

## ÉPICO 5 — "Em Aberto": Oportunidade líquida como estado atual, não log de ações

**Problema:** o chip "Em Aberto" filtra ações com `ngo_conclusao = 'Em Andamento'`.
Isso retorna o log histórico de ações que tocaram negócios em andamento no período,
não o estado atual de oportunidades em aberto. O usuário quer: "oportunidades do
mês Em Andamento AGORA, EXCLUINDO as que viraram ganho (pedido aprovado) ou
perdido (negócio fechado) — estado atual, oscila ao longo do mês."

**Arquivos afetados:**
- `src/components/bi/sections/AcoesDetailWithFilter.tsx` — chip "Em Aberto" muda label para "Em Andamento"
- `src/hooks/bi/useAcoesDetalheRpc.ts` — nova lógica de query quando `statusNegocio = 'Em Andamento'`
- `src/services/biRpcService.ts` — `fetchAcoesDetalhe` precisa handlear novo `p_tipo`
- `rpc_acoes_detalhe` no banco — ALTERAR ou CRIAR nova RPC `rpc_acoes_em_andamento`
- `src/types/biRpc.ts` — novo tipo `AcoesEmAndamentoRow`

---

### Story 5-A: "Em Aberto" mostra oportunidades em andamento como estado atual

**Status:** Draft
**Epic:** EPIC-ACoes-VISUAL-CORRECTIONS
**Prioridade:** Alta
**Complexidade:** Alta — mudança semântica de RPC

#### Descrição

O chip "Em Aberto" (renomeado para "Em Andamento") deixa de ser um filtro de
status no log de ações. Passa a mostrar o conjunto de NEGÓCIOS que, neste exato
momento (data de hoje), estão com `ngo_conclusao = 'Em Andamento'`, foram tocados
por ação no período selecionado, e excluem REPASSE DE MAQUINA.

Cada linha da tabela é um NEGÓCIO (não uma ação). Se um negócio teve 10 ações no
período, aparece 1 linha — a mais recente. Se um negócio perdeu ou ganhou após a
ação, mesmo que dentro do período, não aparece.

#### Comportamento esperado

- Chip label: muda de "Em Aberto" para "Em Andamento" (mais preciso).
- Cada linha é um NEGÓCIO (não uma ação). Coluna "Data" mostra a data da ação
  mais recente que tocou o negócio — não a data de criação do negócio.
- Coluna "Última ação": mostra o tipo de ação mais recente (visita, telefonema etc.).
- Coluna "Dias parado": `NOW() - aco_dthconclusao` da ação mais recente do negócio.
- Exclusão: qualquer negócio com `ngo_conclusao` mudado para Ganho ou Perdido
  após a última ação NO MESMO PERÍODO é EXCLUÍDO — mesmo que a ação esteja
  dentro do período. A decisão de negócio veio depois da ação.
- Contagem: cada linha = 1 negócio único (`DISTINCT ON ngo_numero`).
- Ordenação: por `diasParado` DESC (mais parados primeiro) — o gestor quer
  identificar谁来 precisar de atenção.

#### Dados de entrada

**Fonte:** `mirror.crm_acoes` + `mirror.crm_negocios` canonizado + `mirror.crm_pedidos`

```typescript
interface AcoesEmAndamentoRow {
  negocioNumero: string;    // ngo_numero
  cliente: string;          // via JOIN
  cidade: string;           // fn_cli_cidade
  consultor: string;        // aco_vendedor (atribuição híbrida)
  etapa: string;            // ngo_etapa
  valor: number;            // ngo_vlrtotalnegociado
  ultimaAcao: string;       // aco_tipocontato da ação mais recente
  dataUltimaAcao: string;   // aco_dthconclusao da mais recente (string date)
  diasParado: number;       // dias desde dataUltimaAcao
}
```

**Filtros:** vendedor, cidade, período (from/to em `aco_dthconclusao`).

**Lógica de exclusão na query:**

```sql
-- Pseudo-SQL (não é SQL real — ver armadilha 1)
WITH negocios_tocados AS (
  -- ações no período, join com negócio canonizado
),
excluir_ganhos AS (
  -- WHERE EXISTS (pedido Aprovado com pdo_dthaprovacao > aco_dthconclusao)
),
excluir_perdidos AS (
  -- WHERE EXISTS (ngo_datafechamento > aco_dthconclusao)
)
SELECT DISTINCT ON (ngo_numero) ...
```

#### Edge cases

- Negócio tocado no período com ação hoje e fechado hoje: não aparece
  (excluído — a conclusão veio depois).
- Negócio tocado no período e reaberto depois de Gain/Perdido:
  aparece (o status atual é Em Andamento).
- Negócio nunca tocado por ação no período: não aparece (não está no universo
  de "tocadas no período").
- `diasParado > 365`: renderizar em vermelho (mesma convenção do mapa).

#### Critérios de aceite

- [ ] AC1: Given `/bi/acoes` com chip "Em Andamento" ativo,
      Then cada linha da tabela é exatamente 1 NEGÓCIO único
      (não duplicatas por ação múltipla no mesmo negócio).
- [ ] AC2: Given `/bi/acoes` com chip "Em Andamento" ativo,
      When um negócio do período foi fechado como Ganho ou Perdido
      (mesmo que a conclusão seja depois da ação do período),
      Then esse negócio NÃO aparece na tabela.
- [ ] AC3: Given `/bi/acoes` com chip "Em Andamento" ativo,
      When um negócio está com `ngo_conclusao = 'Em Andamento'` hoje,
      Then ele aparece independent da data de conclusão
      (estado atual, não log histórico).
- [ ] AC4: Given chip "Em Andamento" ativo,
      Then a ordenação padrão é `diasParado` DESC
      (mais parados primeiro — para priorizar ação).
- [ ] AC5: Given chip "Em Andamento" ativo,
      Then a contagem total da paginação bate com `funil.oportunidades`
      do card do funil (para a mesma janela).
      **Importante:** se não bater, a lógica de exclusão pode estar
      diferente da RPC do funil — investigar antes de declarar done.
- [ ] AC6: Given chip "Em Andamento" e `diasParado > 90`,
      Then o valor aparece em vermelho (mesma convenção de cores do mapa).
- [ ] AC7: Given `npm run build`, When executado, Then sucesso.

#### Risco

- **Semântica diferente da RPC atual:** `rpc_acoes_detalhe` hoje filtra ações.
  A nova lógica é radicalmente diferente: um negócio pode ter múltiplas ações,
  mas só 1 linha. NÃO fazer `WHERE ngo_conclusao = 'Em Andamento'` simples —
  isso ainda retorna ações, não o estado. A nova query precisa ser explicitamente
  sobre "negócios únicos, estado atual, excluindo os que mudaram de status depois
  da ação".
- **Regressão de contagem:** se a nova query retornar número diferente de
  `funil.oportunidades`, há um bug de semântica. Medir e comparar antes de
  declarar done.
- **Regressão de ordenação:** hoje "Em Aberto" não tinha ordenação explícita.
  Agora tem `diasParado DESC` — confirmar que não quebra expectativa de nenhum
  stakeholder (o PM 认为 é melhor para gestão, mas validar com demand owner).
- **@dev: nova RPC ou extensão de existente?** Recomendação PM: criar
  `rpc_acoes_em_andamento` nova (paralela, menor risco de quebra da query
  de ações). Não alterar `rpc_acoes_detalhe` que já funciona para Ganho/Perdido
  (mesmo que agora use tabelas separadas nos items 4-A e 4-B).
- **Armadilha do contrato:** esta mudança não altera o card do funil
  (`rpc_acoes_funil_gestao` continua contando `oportunidades` como antes).
  A tabela "Em Andamento" é uma VISUALIZAÇÃO do mesmo conceito por ângulo
  diferente. Se divergirem, o contrato do funil é a fonte oficial.

---

## Resumo de Riscos Transversais

| Risco | Nível | Mitigação |
|---|---|---|
| DRY: Degrau extraído vs. duplicado | Alto | Extrair `AcoesDegrauBar.tsx` ANTES de reescrever |
| DRY: RPCs paralelas multiplicando CTEs | Médio | @architect revisa pattern antes de @dev implementar |
| Regressão de contagem em "Em Andamento" | Alto | Medir com banco vivo antes de declarar done |
| Sem_contato SEM drill-down | Baixo | Usuário decidiu — desabilitar capability sem erro |
| Dead code de tipos/applications após remoção | Médio | Grep antes de deletar; build valida depois |
| Monolito > 300 linhas em novos componentes | Médio | Limite de 150 para tabelas novas; 200 para wrappers |

---

## Priorização (MoSCoW)

| Story | Prioridade | Ordem |
|---|---|---|
| 1-A (formato visual único) | **Must** | 1 |
| 2-A (remover sem contato) | **Must** | 2 |
| 4-A (drill-down pedidos) | **Must** | 3 |
| 4-B (drill-down negócios) | **Must** | 4 |
| 5-A (em andamento estado atual) | **Must** | 5 |
| 3-A (repensar desperdício) | **Should** | 6 — bloqueado até @ux |

---

## Dependências

- Story 3-A depende de `@ux` antes de implementação.
- Stories 4-A e 4-B podem ser implementadas em paralelo (arquivos distintos).
- Story 5-A não bloqueia 4-A/4-B, mas usa o mesmo caller (`AcoesSection`).

## Definition of Done

- [ ] Todos os ACs de todas as stories marcados como done
- [ ] `npm run build` passa sem erro TS
- [ ] `npx vitest run` passa (testes existentes não quebram)
- [ ] Feature doc atualizada (`docs/features/acoes-bi.md`) com novos contratos
- [ ] Handoff para `@qa` com checklist de regressão por story
