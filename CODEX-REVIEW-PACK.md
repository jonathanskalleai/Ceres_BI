# Codex Review Pack — /bi/acoes Correções v10

**TL;DR (3 linhas):** Plano de 5 correções na tela `/bi/acoes`: (1) unificar visual de Ganho/Perdido em barra horizontal idêntica a Visitas/Oportunidades; (2) remover a aba "Clientes sem contato" (8 mil registros, utilidade zero); (3) repensar visualização de Desperdício (conceito ok, formato ruim); (4) drill-down de Ganho mostrar PEDIDOS e Perdido mostrar NEGÓCIOS (não ações); (5) "Em Aberto" virar "Em Andamento" listado por NEGÓCIO ÚNICO com exclusão dos que viraram ganho/perdido (estado atual ao vivo). Cria 3 RPCs novas ADITIVAS (não altera nenhuma existente). Story 3-A bloqueada até @ux.

**Documentos completos:**
- PRD (5 épicos, 6 stories, MoSCoW, ACs): `.aivoux/prds/PRD-AcoesCorrecoesV10.md` (~200 ln)
- Architecture (pattern RPCs, component tree, migrations, riscos): `.aivoux/architecture/ARCH-AcoesV10.md` (~485 ln)
- Feature doc (contrato de 3 fontes — NÃO violar): `docs/features/acoes-bi.md`

---

## Decisões já fechadas com o usuário (NÃO re-litigar)

| # | Decisão | Origem |
|---|---------|--------|
| 1 | Ganho/Perdido no bloco "Atividade e desfechos" = mesmo formato de Degrau (barra larga) que Visitas/Oportunidades. Cores: success/danger. | Demanda original + screenshot |
| 2 | Aba "Sem Contato" removida de vez (sem replacement). Mini-card top-3 deletado. | Demanda original + validação usuário |
| 3 | Desperdício: manter conceito, repensar visual. Story 3-A BLOCKED até @ux. | Demanda original |
| 4 | Drill-down Ganho → PEDIDOS aprovados (não ações). Drill-down Perdido → NEGÓCIOS perdidos (não ações). | Demanda original |
| 5 | "Em Aberto" → "Em Andamento". Tabela lista 1 linha por NEGÓCIO (não por ação). Excluir do card os negócios do período que viraram ganho/perdido (mesmo após janela). Ordenação: diasParado DESC; >90 dias em vermelho. | Demanda original + validação usuário |

---

## Críticas self-asked (o que pode dar errado segundo o architect)

1. **DRY quebrado se @dev não extrair `AcoesDegrauBar.tsx` ANTES** de reusar para Ganho/Perdido. Risco ALTO.
2. **Regressão de contagem em Em Andamento.** AC5 do PRD exige `COUNT(*) da nova RPC == funil.oportunidades` (ambos medem o mesmo conjunto mas por ângulos diferentes). Se divergir → bug. Validação cruzada OBRIGATÓRIA no banco vivo antes de declarar done.
3. **RPCs paralelas vs. parametrização de `rpc_acoes_detalhe`.** Architect escolheu paralelas (isolamento de contrato, dedup keys diferentes). PM também recomendou. **Custo:** 3 CTEs `negocios_canonicos` idênticas copiadas em cada RPC. **Risco:** se a canonização mudar no futuro, são 4 arquivos para atualizar (aceitável — mecânico).
4. **`rpc_acoes_detalhe` v6 NÃO é alterada** — ela continua servindo "Todos" e "Em Aberto" legacy. Story 5-A cria `rpc_acoes_em_andamento` paralela. UI precisa de routing por `statusNegocio`. Se a query nova divergir silenciosamente da antiga, "Em Andamento" via detail-filter mostra contagem diferente do "Em Andamento" via tabela nova. Investigar antes de merge.
5. **Grant permissions** — as 3 novas RPCs são `SECURITY DEFINER` rodando como owner (provavelmente `supabase_admin`). Se owner não tiver SELECT em `mirror.crm_pedidos` / `mirror.crm_negocios`, função retorna 0 linhas sem erro (silencioso). Mitigação: testar com `SELECT ... FROM rpc_acoes_pedidos_ganhos(...)` após GRANT.
6. **Indexação** — EXPLAIN ANALYZE pode propor índices novos. Architect estimou que os padrões são cobertos pelos existentes, mas só `@data-engineer` rodando a query pode confirmar.
7. **PostgREST cache** — todo deploy de RPC exige `NOTIFY pgrst, 'reload schema'` ou SIGUSR1 no container. Sem isso, a função é criada mas o PostgREST não a enxerga (erro PGRST202). Documentado em `acoes-bi.md` armadilha v7.
8. **Dead code após Story 2-A:** `useAcoesGestaoListasRpc` ainda chama `rpc_acoes_gestao_listas('sem_contato', ...)` — mas nunca é invocado. **Não deletar** o hook nem a RPC (story 3-A pode reativar).
9. **`AcoesSemContatoRow` órfão** — após remover sem_contato, o tipo pode não ter mais consumer. Grep antes de remover.
10. **Mirror sync lag** — `staleTime: 5min` nos hooks novos significa até 5 min de defasagem após CRM criar/editar pedido. Aceitável para BI.

---

## Plano de implementação (do ARCH §4)

### FASE 1 — Banco (ADIÇÃO pura, não quebra nada)
3 migrations novas em `supabase/migrations/`:
- `20260803_rpc_acoes_pedidos_ganhos_v1_ganhos_detalhe.sql`
- `20260803_rpc_acoes_negocios_perdidos_v1_perdidos_detalhe.sql`
- `20260803_rpc_acoes_em_andamento_v1_em_andamento_estado.sql`

Aplicação: `@data-engineer` via `mcp__supabase__apply_migration` (banco vivo Supabase self-hosted na VPS).

Validação PRÉ-PR:
- `SELECT * FROM rpc_acoes_pedidos_ganhos('2026-07-01', '2026-07-31', NULL, NULL, 50, 0)` → total ≥ 26 (referência: 26 ganhos julho/2026)
- `SELECT * FROM rpc_acoes_negocios_perdidos('2026-07-01', '2026-07-31', NULL, NULL, 50, 0)` → total = 7
- Validação cruzada Em Andamento: `COUNT(*) FROM rpc_acoes_em_andamento('2026-07-01', '2026-07-31', NULL, NULL, NULL, NULL)` == `funil.oportunidades` da RPC do funil
- `EXPLAIN ANALYZE` das 3 queries — propor índice se `Seq Scan` em tabelas > 100k rows

### FASE 2 — Frontend (depende de FASE 1 no ar)
- Extrair `AcoesDegrauBar.tsx` (Story 1-A)
- Reescrever `AcoesDesfechosPeriodo.tsx` como wrapper fino (Story 1-A)
- Remover aba `sem_contato` de `AcoesGestaoCarteira.tsx` (Story 2-A)
- Deletar `AcoesGestaoCarteiraSummary.tsx` (Story 2-A)
- Criar `usePedidosGanhosRpc.ts` + `AcoesPedidosTable.tsx` (Story 4-A)
- Criar `useNegociosPerdidosRpc.ts` + `AcoesNegociosPerdidosTable.tsx` (Story 4-B)
- Criar `useEmAndamentoRpc.ts` + `AcoesEmAndamentoTable.tsx` (Story 5-A)
- Routing em `AcoesDetailWithFilter.tsx` por `statusNegocio`
- Renomear chip "Em Aberto" → "Em Andamento"

### FASE 3 — Story 3-A (BLOCKED)
Redesign de Desperdício — depende de `@ux` propor + usuário validar.

---

## Perguntas que quero que o Codex responda (escopadas)

1. **A decisão de criar 3 RPCs paralelas em vez de parametrizar `rpc_acoes_detalhe` com `p_tipo`** é defensável? Ou o ganho de DRY (uma CTE `negocios_canonicos` compartilhada) compensa a complexidade de manter 4 branches numa função só?

2. **A regra de exclusão na RPC `rpc_acoes_em_andamento`** (excluir do card negócios do período que viraram ganho/perdido mesmo após janela) está correta? O usuário diz "estado atual ao vivo, oscila ao longo do mês". Faz sentido que a contagem do card de Oportunidades abertas MUDE retroativamente quando um negócio de 30 dias atrás for fechado hoje?

3. **A validação cruzada AC5 (`COUNT(*) da em_andamento == funil.oportunidades`)** é o teste certo? As duas queries medem o mesmo conjunto por definição, então se divergirem é bug. Mas há algum caso onde faz sentido elas divergirem?

4. **Riscos não mapeados.** O architect listou 10. Falta algo crítico? Sugestões:
   - Concorrência / race conditions na mirror sync?
   - Vacuum/autovacuum impactando performance das queries novas?
   - Algum caso onde `ngo_conclusao` muda múltiplas vezes (Em Andamento → Perdido → Em Andamento)?
   - Timezone / DST bugs em `diasParado`?

5. **Story 3-A (Desperdício) — qual redesign você proporia** se fosse designer + dev sênior olhando os dados atuais (`AcoesDesperdicioRow`: cliente, cidade, visitas, acoes, oportunidades, visitasPorOportunidade)?

6. **A ordem de implementação** (1-A → 2-A → 4-A → 4-B → 5-A, com 3-A bloqueada) é a melhor? Alguma story deveria ser reordenada para reduzir risco?

7. **A definição de "estado atual"** para Story 5-A — estou usando `ngo_conclusao` na data de hoje. E se o usuário fechar um negócio hoje que foi tocado em uma ação de 60 dias atrás? Minha lógica exclui (porque `ngo_datafechamento > aco_dthconclusao`). Correto?

---

## Métricas de aceite (do PRD §Definition of Done)

- Todos os ACs marcados como done
- `npm run build` passa sem erro TS
- `npx vitest run` passa
- Feature doc atualizada com novos contratos
- Handoff para @qa com checklist de regressão por story

---

## Apêndice A — Story 3-A (Desperdício): proposta do @ux

Documento completo: `.aivoux/ux/UX-DesperdicioV2.md` (210 linhas).

**Recomendação @ux:** Opção D — Tabela de alertas com InlineBar + badge `[!] SEM OPORTUNIDADE`.

**Diagnóstico (3 problemas):**
1. Razão visitas/oportunidades sem escala visual (texto puro, sem barra).
2. NULLs (cliente com 0 oportunidades) invisíveis — pior caso aparece como `—`.
3. Ausência de ranking e hierarquia visual.

**Solução:** portar padrões que JÁ EXISTEM no codebase (`isAlert` de `ClienteTable`, `InlineBar` de `AcoesEsforcoRetorno`). Mudança mínima:
- Coluna "Gravidade" com InlineBar (largura proporcional ao max da página).
- Badge vermelho `[!] SEM OPORTUNIDADE` quando `oportunidades === 0 && visitas >= 10`.
- Background danger sutil na linha (`8% opacity`).
- Ordenação: NULL primeiro, depois `visitasPorOportunidade DESC`.

**Pendências abertas para o Codex opinar:**
- **Edge case `visitas = 0`:** cliente inativo não é desperdício — filtrar na RPC ou na UI? @ux sugere verificar com @data-engineer se a RPC já filtra.
- **Ordenação NULLS FIRST:** a RPC atual já ordena assim para `desperdicio`? Se não, precisa mudar.
- **`visitasPorOportunidade === 0` (não NULL):** distinto do NULL. Recomendação @ux: barra vazia sem badge.

**Wireframe ASCII** (resumido, ver doc completo §4):

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  GESTAO DE CARTEIRA — Desperdicio                               [Search...]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  # │ Cliente                    │ Cidade      │ Visitas │ Oport. │ Gravidade  │
├────┼────────────────────────────┼─────────────┼─────────┼────────┼────────────┤
│  1 │ Supermercado Central       │ Sao Paulo   │    47   │    0   │ ███████████│
│    │  [!] SEM OPORTUNIDADE      │             │         │        │            │
├────┼────────────────────────────┼─────────────┼─────────┼────────┼────────────┤
│  2 │ Academia Corp             │ Sao Paulo   │    25   │    1   │ ████████░░ │
│    │                            │             │         │        │ 25.0/oport │
├────┴────────────────────────────┴─────────────┴─────────┴────────┴────────────┤
│  Pagina 1 de 3   [<] [1] [2] [3] [>]                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Quando rodar:** Story 3-A está em paralelo com as outras 5 — pode implementar depois de @dev começar Story 1-A. Não bloqueia.