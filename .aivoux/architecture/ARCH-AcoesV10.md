# ARCH-AcoesV10 — Design Técnico: /bi/acoes Correções v10

**Versão:** 1.0
**Data:** 2026-08-03
**Autor:** @architect (Aria)
**Status:** Aprovado — pronto para @dev

---

## 1. Pattern de RPCs

### Decisão: 5 RPCs paralelas

A recomendação PM de RPCs paralelas é **correta e ratificada**. A justificativa técnica é mais forte do que o PM articulou:

| RPC | Fonte primária | Chave dedup | Semântica |
|-----|----------------|-------------|----------|
| `rpc_acoes_detalhe` v6 | `crm_acoes` | `aco_idacao` | **Log de ações** — uma linha por ação |
| `rpc_acoes_pedidos_ganhos` v1 | `crm_pedidos` | `pdo_codigointerno` | **Pedidos aprovados** — uma linha por pedido |
| `rpc_acoes_negocios_perdidos` v1 | `crm_negocios` | `ngo_numero` | **Negócios perdidos** — uma linha por negócio |
| `rpc_acoes_em_andamento` v1 | `crm_acoes + crm_negocios` | `ngo_numero` | **Estado de oportunidades** — uma linha por negócio, estado atual |
| `rpc_acoes_gestao_listas` (existente) | `crm_acoes + crm_negocios` | `cli_idcliente` | **Gestão de carteira** — inalterada |

### Por que NÃO parametrizar `rpc_acoes_detalhe` com `p_tipo`

Parametrizar uma RPC existente com `p_tipo IN ('acoes'|'pedidos'|'negocios'|'em_andamento')` criaria:

1. **4 ветви SQL distintas** dentro da mesma função — manutenção de 4 CTEs diferentes num único arquivo, sem isolamento de regressão
2. **Contratos de retorno incompatíveis**: `AcoesDetalheItem` (ação) tem 11 campos; `PedidoDetalheRow` (pedido) tem 8; `NegocioPerdidoRow` tem 7; `AcoesEmAndamentoRow` tem 9. Unificar o retorno em `json` genérico perde tipagem estática em TypeScript.
3. **Paginação com lógica diferente**: ações usam `ORDER BY aco_dthconclusao DESC`; pedidos usam `ORDER BY pdo_dthaprovacao DESC`; negócios usam `ORDER BY ngo_datafechamento DESC`; em_andamento usa `ORDER BY diasParado DESC`. Tudo diferente.
4. **O risco de quebra**: modificar a RPC que hoje alimenta "Todos" e "Em Aberto" (via `p_status`) para acomodar "Ganho" e "Perdido" é o caminho mais arriscado. Uma RPC quebrada afeta 4 fluxos; 4 RPCs isoladas significam 1 quebrada afeta 1 fluxo.

### CTEs compartilhadas (DRY dentro de cada RPC)

Dentro de cada RPC, as CTEs de canonização são reutilizadas:

```
rpc_acoes_pedidos_ganhos:
  negocios_canonicos (DISTINCT ON ngo_numero — REUSADO de rpc_acoes_bi v9)
  pedidos_dedup (DISTINCT ON pdo_codigointerno)
  → output: pedidos aprovados no periodo, join canonico

rpc_acoes_negocios_perdidos:
  negocios_canonicos (MESMA CTE — não recriar)
  → output: negocios Perdido no periodo

rpc_acoes_em_andamento:
  negocios_canonicos (MESMA CTE — não recriar)
  filtered (acoes no periodo)
  → 3 CTEs de exclusao (ganhos, perdidos, Repasse)
  → output: negocios UNICOS em Andamento tocados no periodo
```

As 3 CTEs `negocios_canonicos` são **idênticas** às de `rpc_acoes_bi` v9 e `rpc_acoes_funil_gestao` v6. Não se recria a lógica de dedup — copia-se o bloco exato. Qualquer alteração futura na canonização (ex: novo campo de ordenação) obrigará a atualizar todas as 4 funções, e isso é aceitável porque são 4 arquivos independentes e a mudança é mecânica.

---

## 2. Mudanças em `rpc_acoes_detalhe`

**`rpc_acoes_detalhe` v6 NÃO é alterada.** Ela permanece responsável por:

- `statusNegocio = ""` (Todos) → todas as ações sem filtro de status
- `statusNegocio = "Em Andamento"` (chip atual) → ações deduplicadas por negócio com `ngo_conclusao = 'Em Andamento'` + funis comerciais

A Story 5-A cria `rpc_acoes_em_andamento` **paralela**, não substitui. O chip "Em Aberto" vira "Em Andamento" na UI, mas **não migra a query** da `rpc_acoes_detalhe`. Motivo: AC5 exige que a contagem de `rpc_acoes_em_andamento` bata com `funil.oportunidades` — se a nova query for implementada como extensão de `rpc_acoes_detalhe`, qualquer erro de lógica diverge silenciosamente do funil. RPC separada permite validar cada uma independentemente.

### Plano de validação cruzada (AC5)

Antes de declarar Story 5-A done, @dev **obrigatoriamente** executa:

```sql
-- Contagem do funil (fonte oficial)
SELECT funil.oportunidades
FROM public.rpc_acoes_funil_gestao('2026-07-01', '2026-07-31', NULL, NULL) AS t,
     json_to_recordset(t.rankingConsultores) AS r(consultor text, visitas int, oportunidades int, ganhos int, valorGanho numeric, taxaConversao numeric);

-- Contagem da nova RPC (deve ser idêntica)
SELECT COUNT(*)
FROM public.rpc_acoes_em_andamento('2026-07-01', '2026-07-31', NULL, NULL);
```

Se divergir, há bug de exclusão na nova query — não "diferença conceitual". A contagem deve ser idêntica porque ambas medem o mesmo conjunto: negócios únicos, tocados por ação no período, sem Repasse, ainda `ngo_conclusao = 'Em Andamento'` na data atual.

---

## 3. Component Tree

```
/bi/acoes
└── AcoesSection.tsx (301 ln)                          [INALTERADO — caller, gerencia estado]
    │
    ├── AcoesKpiGrid.tsx                              [INALTERADO]
    │
    ├── AcoesFunilConversao.tsx (185 ln)             [Story 1-A: extrai Degrau → AcoesDegrauBar]
    │   ├── (inline Degrau)                           [EXTRAÍDO → AcoesDegrauBar.tsx]
    │   ├── (inline Conector)                         [INALTERADO — simples]
    │   └── AcoesDesfechosPeriodo.tsx (114 ln)       [Story 1-A: vira wrapper fino]
    │       └── AcoesDegrauBar × 2                   [NOVO — reusado 4x no bloco]
    │           (props: icon, label, valor, accent, hint, larguraPct)
    │
    ├── AcoesEsforcoRetorno.tsx                      [INALTERADO]
    │
    ├── AcoesRankingConsultores.tsx                   [INALTERADO]
    │
    ├── AcoesRankingTable.tsx                         [INALTERADO]
    │
    ├── Charts (HorizontalBarChart, LineChart, etc.)   [INALTERADO]
    │
    ├── AcoesClientesTable.tsx                        [INALTERADO]
    │
    ├── AcoesGestaoCarteira.tsx (197 ln)             [Story 2-A: remove sem_contato de TABS]
    │   ├── (SemContatoTable)                         [INALTERADO — mas drilling removido]
    │   ├── DesperdicioTable                          [Story 3-A: redesign pendente @ux — BLOCKED]
    │   ├── NegativasTable                            [INALTERADO]
    │   └── drill-down do chart "Clientes em Risco"  [Story 2-A: desabilitado quando sem_contato some]
    │
    ├── AcoesGestaoCarteiraSummary.tsx                [DELETADO — Story 2-A]
    │
    ├── AcoesMapaOportunidades.tsx                    [INALTERADO]
    │
    └── AcoesDetailWithFilter.tsx (87 ln)            [Stories 4-A, 4-B, 5-A: roteia tabela]
        │
        ├── STATUS_OPTIONS:                           [Story 5-A: label "Em Aberto" → "Em Andamento"]
        │   { value: "",           label: "Todos" }
        │   { value: "Em Andamento", label: "Em Andamento" }  ← RENOMEADO
        │   { value: "Ganho",      label: "Ganho" }
        │   { value: "Perdido",    label: "Perdido" }
        │
        ├── statusNegocio === "Em Andamento"         [Story 5-A]
        │   └── AcoesEmAndamentoTable.tsx             [NOVO — 1 linha por negócio]
        │       └── hook: useEmAndamentoRpc.ts        [NOVO]
        │
        ├── statusNegocio === "Ganho"                 [Story 4-A]
        │   └── AcoesPedidosTable.tsx                 [NOVO — 1 linha por pedido aprovado]
        │       └── hook: usePedidosGanhosRpc.ts      [NOVO]
        │
        ├── statusNegocio === "Perdido"                [Story 4-B]
        │   └── AcoesNegociosPerdidosTable.tsx        [NOVO — 1 linha por negócio perdido]
        │       └── hook: useNegociosPerdidosRpc.ts   [NOVO]
        │
        └── (caso padrão: "")
            └── AcoesDetailTable.tsx                  [RENOMEADO conceitual → AcoesAcoesTable.tsx
                                                      mas KEEP file name atual;
                                                      1 linha por ação, inalterado]

NOVA ESTRUTURA DE ARQUIVOS
───────────────────────────

src/components/bi/
├── AcoesDegrauBar.tsx                    [NOVO — extraído de AcoesFunilConversao]
│   Props: { estagio: Estagio, valor: number, base: number, accent?: string }
│   accent opcional: se ausente → gradiente champagne (Visitas/Oportunidades);
│                    se presente → cor sólida (Ganho/Perdido)
│
├── sections/
│   ├── AcoesFunilConversao.tsx           [Story 1-A: extrai Degrau inline → AcoesDegrauBar]
│   │                                     Limite: ≤ 200 ln (regras #4)
│   │   └── usa AcoesDegrauBar × 4
│   │
│   ├── AcoesDesfechosPeriodo.tsx        [Story 1-A: wrapper fino com 2 AcoesDegrauBar]
│   │                                     Limite: ≤ 60 ln (wrapper puro)
│   │
│   ├── AcoesGestaoCarteira.tsx          [Story 2-A: remove sem_contato de TABS]
│   │   └── AcoesGestaoCarteiraSummary.tsx [DELETADO]
│   │
│   └── AcoesDetailWithFilter.tsx         [Stories 4-A, 4-B, 5-A: roteia por status]
│
├── AcoesPedidosTable.tsx                  [NOVO — Story 4-A; ≤ 150 ln]
│   Colunas: Nº Pedido | Cliente | Cidade | Consultor | Data Aprovação | Valor
│   Ordenação: pdo_dthaprovacao DESC
│
├── AcoesNegociosPerdidosTable.tsx         [NOVO — Story 4-B; ≤ 150 ln]
│   Colunas: Nº Negócio | Cliente | Cidade | Consultor | Data Fechamento | Valor
│   Ordenação: ngo_datafechamento DESC
│
├── AcoesEmAndamentoTable.tsx              [NOVO — Story 5-A; ≤ 150 ln]
│   Colunas: Nº Negócio | Cliente | Cidade | Consultor | Etapa | Valor |
│            Ultima Ação | Data Última Ação | Dias Parado
│   Ordenação: diasParado DESC
│   Destaque: diasParado > 90 → vermelho
│
└── tables/ (ou inline em sections/)
    ├── AcoesDetailTable.tsx               [RENOMEADO conceitual para AcoesAcoesTable.tsx]
    │                                     [opcional: rename arquivo para clareza]
    ├── SemContatoTable.tsx                [INALTERADO — mas drilling removido]
    ├── DesperdicioTable.tsx               [BLOCKED — Story 3-A]
    └── NegativasTable.tsx                 [INALTERADO]
```

### O que SAI

| Arquivo | Ação | Motivo |
|---------|------|--------|
| `AcoesGestaoCarteiraSummary.tsx` | **DELETAR** | Decisão explícita do usuário; `SemContatoTable` permanece exportado em `AcoesGestaoCarteiraTables.tsx` (verificar grep antes de deletar o arquivo Tables) |
| `AcoesFunilConversao.tsx` (Degrau inline) | **MOVER para `AcoesDegrauBar.tsx`** | DRY: mesmo componente usado 4x no bloco Atividade |
| Dead types: `AcoesSemContatoRow` export se órfão | **VERIFICAR** | Após remover `sem_contato`, o tipo pode ficar órfão se não houver outro consumidor |

---

## 4. Migration Strategy

### Ordem de criação e aplicação

```
FASE 1 — Pré-requisitos (pode rodar em paralelo com base atual — zero quebra)
├── 20260803_rpc_acoes_pedidos_ganhos_v1_ganhos_detalhe.sql
│   └── Cria: rpc_acoes_pedidos_ganhos(p_from, p_to, p_vendedor, p_cidade, p_limit, p_offset)
│       Retorno: { rows: PedidoDetalheRow[], total: number }
│       Fonte: crm_pedidos + negocios_canonicos
│       Dedup: DISTINCT ON (pdo_codigointerno)
│       Filtros: Aprovado, periodo (pdo_dthaprovacao), negocio Ganho, sem Repasse
│       Ordenação: pdo_dthaprovacao DESC
│       Grants: anon, authenticated, service_role
│
├── 20260803_rpc_acoes_negocios_perdidos_v1_perdidos_detalhe.sql
│   └── Cria: rpc_acoes_negocios_perdidos(p_from, p_to, p_vendedor, p_cidade, p_limit, p_offset)
│       Retorno: { rows: NegocioPerdidoRow[], total: number }
│       Fonte: negocios_canonicos (reusado de rpc_acoes_bi v9)
│       Filtros: ngo_conclusao='Perdido', periodo (ngo_datafechamento), sem Repasse
│       Exclusão: ngo_funil = 'REPASSE DE MAQUINA'
│       Ordenação: ngo_datafechamento DESC
│       Grants: anon, authenticated, service_role
│
└── 20260803_rpc_acoes_em_andamento_v1_em_andamento_estado.sql
    └── Cria: rpc_acoes_em_andamento(p_from, p_to, p_vendedor, p_cidade, p_limit, p_offset)
        Retorno: { rows: AcoesEmAndamentoRow[], total: number }
        Fonte: crm_acoes + crm_negocios + crm_pedidos
        Semântica: estado atual, não log histórico
        Lógica:
          1. filtered: ações no período com aco_dthconclusao::date
          2. negocios_tocados: filtered + join negocios_canonicos (ngo_conclusao='Em Andamento', sem Repasse)
          3. excluir_ganhos: WHERE EXISTS pedido Aprovado com pdo_dthaprovacao > aco_dthconclusao
          4. excluir_perdidos: WHERE EXISTS negocio Perdido com ngo_datafechamento > aco_dthconclusao
          5. DISTINCT ON (ngo_numero) — 1 linha por negócio
        Ordenação: diasParado DESC
        Grants: anon, authenticated, service_role

FASE 2 — Código frontend (depende de FASE 1 aplicada)
├── Adicionar 3 hooks novos
├── Criar 3 tabelas novas
├── Extrair AcoesDegrauBar.tsx
├── Reescrever AcoesDesfechosPeriodo.tsx
├── Roteamento em AcoesDetailWithFilter.tsx
└── Deletar AcoesGestaoCarteiraSummary.tsx + remover sem_contato de TABS

FASE 3 — Story 3-A (BLOCKED até @ux)
└── Redesign de DesperdicioTable — pendente input de @ux
```

### Nomes de migration em snake_case

Formato: `YYYYMMDD_rpc_<nome>_v<N>_<escopo>.sql`

| Migration | Nome completo |
|-----------|---------------|
| Pedidos ganhos | `20260803_rpc_acoes_pedidos_ganhos_v1_ganhos_detalhe.sql` |
| Negocios perdidos | `20260803_rpc_acoes_negocios_perdidos_v1_perdidos_detalhe.sql` |
| Em andamento estado | `20260803_rpc_acoes_em_andamento_v1_em_andamento_estado.sql` |

### Compatibilidade com base atual

**FASE 1 é 100% aditiva** — cria 3 funções novas, não modifica nenhuma existente. Pode ser aplicada a produção sem risco de regressão nas 4 telas que usam `rpc_acoes_detalhe`, `rpc_acoes_bi` e `rpc_acoes_funil_gestao`.

**FASE 2 só entra em produção após FASE 1** — os hooks novos chamam funções que ainda não existem; a chamada falha com erro de função inexistente (PGRST202), que é visível e diagnosticável. Não quebra silêncio.

---

## 5. Riscos Arquiteturais Não Mapeados pelo PM

### 5.1. Indexação

As 3 novas RPCs usam padrões já cobertos pelos índices existentes:

| RPC | Padrão de acesso | Índice necessário? |
|-----|-----------------|-------------------|
| `rpc_acoes_pedidos_ganhos` | `pdo_dthaprovacao`, `pdo_codigointerno` | `idx_pedidos_dthaprovacao` provavelmente já existe; verificar com `\di mirror.crm_pedidos*` |
| `rpc_acoes_negocios_perdidos` | `ngo_datafechamento`, `ngo_conclusao` | `idx_negocios_conclusao_datafechamento` — verificar; pode precisar |
| `rpc_acoes_em_andamento` | `aco_dthconclusao`, `ngo_numero`, `pdo_dthaprovacao` | join em `ngo_numero` entre ações e negócios canonizados — `idx_acoes_nronegocio` já existe; `pdo_dthaprovacao` join com `ngo_numero` — sem índice novo se `ngo_numero` em `crm_pedidos` já tem |

**Ação**: @data-engineer executa `EXPLAIN ANALYZE` das 3 queries no banco vivo antes de declarar done. Se `Seq Scan` em tabelas > 100k rows, propor índice.

### 5.2. Ordem de criação de funções referenciadas

As 3 novas RPCs referenciam `mirror.fn_cli_cidade()` e `mirror.usuarios`. Se essas funções forem recriadas (ex: renomeadas, dropadas), as 3 novas quebram silenciosamente. Mitigação: `COMMENT ON FUNCTION` em cada uma declara as dependências. Regra: nunca renomear/dropar função referenciada sem verificar callers.

### 5.3. Grant permissions

Todas as 3 funções devem ter:

```sql
GRANT EXECUTE ON FUNCTION public.rpc_acoes_pedidos_ganhos(...)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_negocios_perdidos(...)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(...)
  TO anon, authenticated, service_role;
```

O `SECURITY DEFINER` nas funções existentes executa como o owner (provavelmente `supabase_admin`). Verificar se o owner tem `SELECT` em `mirror.crm_acoes`, `mirror.crm_negocios`, `mirror.crm_pedidos`, `mirror.usuarios`, `mirror.crm_carteira_clientes`. Owner sem acesso a uma dessas tabelas produz `permission denied` silencioso (função retorna 0 linhas, não erro).

### 5.4. Cache invalidation no client

As 3 novas RPCs usam `staleTime: 5 * 60_000` (mesmo padrão dos hooks existentes). Query keys:

```typescript
// Pedidos ganhos
['rpc', 'acoes-pedidos-ganhos', from, to, vendedor, cidade, page]

// Negocios perdidos
['rpc', 'acoes-negocios-perdidos', from, to, vendedor, cidade, page]

// Em andamento
['rpc', 'acoes-em-andamento', from, to, vendedor, cidade, page]
```

Quando o usuário cria/edita um pedido ou negócio no CRM, a mirror sync atualiza `mirror.crm_pedidos`/`mirror.crm_negocios`. O staleTime de 5 min significa que o dado pode ter até 5 min de lag após sync. Para um BI, isso é aceitável. **Não implementar invalidation manual** (ex: `queryClient.invalidateQueries`) porque não há webhook de CRM para acionar — a mirror sync é o único feed, e o ciclo é minutos.

### 5.5. Regressão de "Em Andamento" via `rpc_acoes_detalhe`

O chip "Em Andamento" **mantém** `useAcoesDetalheRpc` + `rpc_acoes_detalhe` enquanto a Story 5-A cria `rpc_acoes_em_andamento` para a tabela. A UI precisa de duas variáveis de estado separadas:

```typescript
// Estado atual (Story 5-A)
const [emAndamentoTableRows, setEmAndamentoTableRows] = useState<AcoesEmAndamentoRow[]>([]);
// Mantido para o chip "Em Andamento" em AcoesDetailWithFilter
const { statusNegocio } = useNegociosFilter(); // "" | "Em Andamento" | "Ganho" | "Perdido"
```

O routing em `AcoesDetailWithFilter.tsx` decide qual tabela renderizar baseado em `statusNegocio`. Se `statusNegocio === "Em Andamento"`, renderiza `AcoesEmAndamentoTable` (nova, usa `rpc_acoes_em_andamento`). **Não quebra** a `rpc_acoes_detalhe` existente — ela continua servindo "Todos" e "Em Aberto" original (se ainda houver código legado chamando sem o novo chip).

### 5.6. Regressão do ranking em AcoesSection

O `AcoesSection.tsx` importa `useAcoesDetalheRpc` para alimentar `AcoesDetailWithFilter`. Se o novo routing de `AcoesDetailWithFilter` exigir dados de uma RPC diferente para "Em Andamento", o `AcoesSection` precisa de um hook novo para esse caso. **Não reutilizar** o hook existente porque ele chama `rpc_acoes_detalhe` — RPC errada para o caso novo.

```typescript
// AcoesSection.tsx — imports necessários após stories 4-A, 4-B, 5-A
import { useAcoesDetalheRpc, ACOES_PAGE_SIZE } from '@/hooks/bi/useAcoesDetalheRpc';  // "Todos"
import { usePedidosGanhosRpc } from '@/hooks/bi/usePedidosGanhosRpc';                 // "Ganho"
import { useNegociosPerdidosRpc } from '@/hooks/bi/useNegociosPerdidosRpc';         // "Perdido"
import { useEmAndamentoRpc } from '@/hooks/bi/useEmAndamentoRpc';                    // "Em Andamento" (novo)
```

### 5.7. Paginação

As 3 tabelas novas usam `PaginationControls` **existente** (reutilização). O componente aceita `page`, `totalPages`, `onPageChange`, `rangeLabel` — interface idêntica para todos os casos. Não criar componente novo de paginação.

`PAGE_SIZE = 50` é reutilizado de `ACOES_PAGE_SIZE` exportado por `useAcoesDetalheRpc.ts`. As 3 tabelas novas importam dele.

### 5.8. `rpc_acoes_gestao_listas` com `p_tipo='sem_contato'` após Story 2-A

Após Story 2-A, `AcoesGestaoCarteira.tsx` remove a aba `sem_contato` de `TABS`. O hook `useAcoesGestaoListasRpc` ainda **existe** e ainda chama `rpc_acoes_gestao_listas('sem_contato', ...)` — mas não é mais invocado porque `tab === "sem_contato"` nunca acontece. **Não deletar** o hook nem a RPC: podem ser necessários no futuro para o drill-down (story bloqueada mas o código está lá para reativar).

### 5.9. Sincronismo de filtros entre tabelas

`AcoesSection` mantém `useEffect` que reseta `page=1` quando filtros mudam (vendedor, cidade, período). As 3 tabelas novas precisam do mesmo comportamento: ao trocar de chip "Ganho" → "Perdido", ou ao mudar vendedor/período, cada tabela deve resetar para página 1. A implementação é no caller (`AcoesDetailWithFilter` ou `AcoesSection`) via `useEffect` idêntico ao existente.

### 5.10. Supabase REST reload após deploy

Conforme armadilha v7 documentada em `acoes-bi.md`: todo deploy de RPC exige `NOTIFY pgrst, 'reload schema'` para que PostgREST recarregue o schema. Em produção VPS, isso pode significar `docker kill -s SIGUSR1` no container do PostgREST. @devops documenta o passo pós-deploy no `deploy.sh`.

---

## 6. Critérios de PR para @dev

### Story 1-A (formato visual único)

- [ ] `AcoesDegrauBar.tsx` criado com props `{ estagio, valor, base, accent? }`
- [ ] `AcoesFunilConversao.tsx` usa `AcoesDegrauBar` para os 2 estágios de atividade (Visitas, Oportunidades) — gradiente champagne inalterado
- [ ] `AcoesDesfechosPeriodo.tsx` usa `AcoesDegrauBar` para Ganho (accent=`var(--voux-success)`) e Perdido (accent=`var(--voux-danger)`)
- [ ] `AcoesDegrauBar` com `accent` ausente → gradiente champagne (caso padrão); com `accent` → cor sólida
- [ ] `AcoesFunilConversao.tsx` ≤ 200 linhas após refatoração
- [ ] `AcoesDesfechosPeriodo.tsx` ≤ 60 linhas após refatoração (wrapper fino)
- [ ] Hint de tooltip mantém fonte original (`crm_pedidos` para Ganho, `crm_negocios` para Perdido)
- [ ] `npm run build` passa sem erro TS

### Story 2-A (remover sem contato)

- [ ] `TABS` em `AcoesGestaoCarteira.tsx` contém apenas `desperdicio` e `negativas`
- [ ] `AcoesGestaoCarteiraSummary.tsx` deletado do projeto (grep confirma: 0 imports restantes)
- [ ] Drill-down do chart "Clientes em Risco" desabilitado quando `sem_contato` não está em `TABS` (silencioso, sem erro)
- [ ] `legenda` useMemo reescrito para apenas 2 branches
- [ ] `grep -r "AcoesGestaoCarteiraSummary" src/` → 0 resultados
- [ ] `grep -r "AcoesSemContatoRow" src/` → verificar se órfão ou em uso (se órfão, remover tipo)
- [ ] `npm run build` passa sem erro TS

### Story 4-A (drill-down Ganho → pedidos)

- [ ] `rpc_acoes_pedidos_ganhos` criada e aplicada ao banco
- [ ] `rpc_acoes_pedidos_ganhos('2026-07-01', '2026-07-31', NULL, NULL, 50, 0)` retorna `total >= 26` (referência: 26 ganhos julho/2026)
- [ ] `usePedidosGanhosRpc.ts` criado com interface idêntica a `useAcoesDetalheRpc` (mesmos params + page)
- [ ] `AcoesPedidosTable.tsx` criado, ≤ 150 linhas
- [ ] Colunas: Nº Pedido | Cliente | Cidade | Consultor | Data Aprovação | Valor
- [ ] Ordenação: `pdo_dthaprovacao DESC`
- [ ] Badge de contexto: "Mostrando pedidos aprovados — fontes: crm_pedidos + crm_negocios."
- [ ] Search client-side dentro da página atual
- [ ] `PaginationControls` reutilizado (sem criar novo componente)
- [ ] Routing em `AcoesDetailWithFilter.tsx`: `statusNegocio === "Ganho"` → `AcoesPedidosTable`
- [ ] AC3 (switch Ganho → Todos): `AcoesDetailTable` retorna corretamente sem regressão
- [ ] `npm run build` passa sem erro TS

### Story 4-B (drill-down Perdido → negócios)

- [ ] `rpc_acoes_negocios_perdidos` criada e aplicada ao banco
- [ ] `rpc_acoes_negocios_perdidos('2026-07-01', '2026-07-31', NULL, NULL, 50, 0)` retorna `total = 7` (referência: 7 perdidos julho/2026)
- [ ] `useNegociosPerdidosRpc.ts` criado
- [ ] `AcoesNegociosPerdidosTable.tsx` criado, ≤ 150 linhas
- [ ] Colunas: Nº Negócio | Cliente | Cidade | Consultor | Data Fechamento | Valor
- [ ] Ordenação: `ngo_datafechamento DESC`
- [ ] Badge de contexto: "Mostrando negócios perdidos — fonte: crm_negocios · ngo_datafechamento."
- [ ] Exclusão de `ngo_funil = 'REPASSE DE MAQUINA'` aplicada na RPC
- [ ] Search + paginação como em 4-A
- [ ] Routing: `statusNegocio === "Perdido"` → `AcoesNegociosPerdidosTable`
- [ ] AC5: switch Perdido → Todos: regressão zero
- [ ] `npm run build` passa sem erro TS

### Story 5-A (Em Andamento → estado atual)

- [ ] `rpc_acoes_em_andamento` criada e aplicada ao banco
- [ ] **Validação cruzada com `funil.oportunidades`**: `COUNT(*) FROM rpc_acoes_em_andamento('2026-07-01', '2026-07-31', NULL, NULL)` == `funil.oportunidades` de `rpc_acoes_funil_gestao('2026-07-01', '2026-07-31', NULL, NULL)`. Se divergir, **não declarar done**.
- [ ] `useEmAndamentoRpc.ts` criado
- [ ] `AcoesEmAndamentoTable.tsx` criado, ≤ 150 linhas
- [ ] Colunas: Nº Negócio | Cliente | Cidade | Consultor | Etapa | Valor | Ultima Ação | Data | Dias Parado
- [ ] Ordenação: `diasParado DESC`
- [ ] `diasParado > 90` → valor em vermelho
- [ ] Badge de contexto: "Mostrando oportunidades em andamento — fonte: crm_acoes + crm_negocios · estado atual."
- [ ] Routing: `statusNegocio === "Em Andamento"` → `AcoesEmAndamentoTable`
- [ ] Chip label em `AcoesDetailWithFilter.tsx`: "Em Aberto" → "Em Andamento"
- [ ] Exclusão de `ngo_funil = 'REPASSE DE MAQUINA'` aplicada na RPC
- [ ] Exclusão de ganhos/perdidos pós-ação no período aplicada na RPC
- [ ] AC1: cada linha = 1 negócio único (sem duplicatas)
- [ ] AC2: negócios fechados no período após a ação não aparecem
- [ ] AC3: negócios reabertos após Gain/Perdido aparecem (estado atual = Em Andamento)
- [ ] `npm run build` passa sem erro TS

### Regressão geral

- [ ] `npm run build` → sucesso sem erro TS
- [ ] `npx vitest run` → 169/169 (ou mais se novos testes)
- [ ] Smoke de todas as 5 stories executado em banco vivo antes de PR
- [ ] Feature doc `docs/features/acoes-bi.md` atualizada com novos contratos de RPC
- [ ] 0 imports de `AcoesGestaoCarteiraSummary` no codebase
- [ ] 0 imports órfãos de `AcoesSemContatoRow` se o tipo for removido

---

## 7. Resumo de arquivos a criar/modificar/deletar

### Criar (migrations)
```
supabase/migrations/20260803_rpc_acoes_pedidos_ganhos_v1_ganhos_detalhe.sql
supabase/migrations/20260803_rpc_acoes_negocios_perdidos_v1_perdidos_detalhe.sql
supabase/migrations/20260803_rpc_acoes_em_andamento_v1_em_andamento_estado.sql
```

### Criar (frontend)
```
src/components/bi/AcoesDegrauBar.tsx                         [Story 1-A]
src/components/bi/AcoesPedidosTable.tsx                     [Story 4-A]
src/components/bi/AcoesNegociosPerdidosTable.tsx            [Story 4-B]
src/components/bi/AcoesEmAndamentoTable.tsx                 [Story 5-A]
src/hooks/bi/usePedidosGanhosRpc.ts                         [Story 4-A]
src/hooks/bi/useNegociosPerdidosRpc.ts                      [Story 4-B]
src/hooks/bi/useEmAndamentoRpc.ts                           [Story 5-A]
src/types/bi/acoesPedidosGanhos.ts                          [Story 4-A — novo arquivo de tipos]
src/types/bi/acoesNegociosPerdidos.ts                       [Story 4-B]
src/types/bi/acoesEmAndamento.ts                            [Story 5-A]
src/services/bi/acoesDetalhePedidosService.ts               [Story 4-A — fetch para pedidos]
                                                        (ou estender acoesGestaoService.ts se espaço permitir)
```

### Modificar
```
src/components/bi/sections/AcoesFunilConversao.tsx          [Story 1-A: extrair Degrau]
src/components/bi/sections/AcoesDesfechosPeriodo.tsx        [Story 1-A: usar AcoesDegrauBar]
src/components/bi/sections/AcoesGestaoCarteira.tsx          [Story 2-A: remover sem_contato]
src/components/bi/sections/AcoesDetailWithFilter.tsx        [Stories 4-A, 4-B, 5-A: roteamento]
src/components/bi/sections/AcoesSection.tsx                   [Stories 4-A, 4-B, 5-A: novos hooks]
src/types/biRpc.ts                                          [Reexportar novos tipos]
```

### Deletar
```
src/components/bi/sections/AcoesGestaoCarteiraSummary.tsx  [Story 2-A]
```
