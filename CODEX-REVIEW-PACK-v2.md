# Codex Review Pack v2 — /bi/acoes (Plano refinado após auditoria v1)

**TL;DR (3 linhas):** Plano v1 do /bi/acoes foi NO-SHIP pelo Codex (5 blockers + 1 bonus). Agora refinado com ground truth do banco VPS self-hosted (Phase 0), decisões fechadas com o usuário (GRANT só revogado das 3 novas, Em Andamento sem distinção de reaberto), AC5 reescrito como invariante JSON executável, e deploy documentado via SSH + docker exec + psql + NOTIFY pgrst. O bonus do TIER FAST bypass FOI falso positivo (não existe na VPS).

**Mudança central vs v1:**
- **AC5 agora é extração de JSON path**, não `COUNT(*)`. Query validada: `(funil.data->'funil'->>'oportunidades')::int == (em_andamento.data->>'total')::int` → 112 == 112.
- **`rpc_acoes_em_andamento` SEM EXISTS de ganho/perdido pós-ação.** Decisão A do usuário: aceita que reaberto genuíno é indetectável sem histórico de `ngo_conclusao`. Mesma regra do `funil.oportunidades` (pura).
- **GRANT das 3 novas: `TO authenticated, service_role` (sem `anon`).** Frontend verificado autenticado (par de hooks com `persistSession: true` + `signInWithPassword` + `ProtectedRoute`). Revogação não quebra nada.
- **Deploy via SSH**, não MCP Supabase. Phase 0 confirmou: MCP/project local não alcança VPS self-hosted.

**Documentos consolidados:**
- PRD: `.aivoux/prds/PRD-AcoesCorrecoesV10.md` (197 ln — mantido do v1, decisões atualizadas)
- Architecture: `.aivoux/architecture/ARCH-AcoesV10-v2.md` (~600 ln — reescrito pelo @architect)
- Security: `.aivoux/security/SEC-REVIEW-AcoesV10.md` (399 ln)
- Ground truth do banco: `.aivoux/state/REL-ESTADO-BANCO.md` (read-only via SSH)
- Feature doc (contrato de 3 fontes): `docs/features/acoes-bi.md`
- UX (Story 3-A): `.aivoux/ux/UX-DesperdicioV2.md`

---

## Decisões fechadas com o usuário (NÃO re-litigar)

| # | Decisão | Origem |
|---|---------|--------|
| 1 | Ganho/Perdido no bloco "Atividade e desfechos" = mesmo formato de Degrau que Visitas/Oportunidades. | Demanda original |
| 2 | Aba "Sem Contato" removida de vez. `AcoesGestaoCarteiraSummary.tsx` deletado. | Demanda + validação |
| 3 | Desperdício: manter conceito, repensar visual. Story 3-A = Opção D do @ux (Tabela de alertas com InlineBar + badge NULL). | @ux |
| 4 | Drill-down Ganho → PEDIDOS; Perdido → NEGÓCIOS. Não ações. | Demanda |
| 5 | "Em Aberto" → "Em Andamento". Lista 1 linha por NEGÓCIO. | Demanda |
| 6 | **Em Andamento SEM distinção de reaberto.** Mesma regra do funil (estado atual canônico). Sem EXISTS adicional no SQL. | Validação usuário (opção A) |
| 7 | **GRANT anon revogado APENAS das 3 RPCs novas.** As 4 existentes (bi, funil_gestao, detalhe, mapa_oportunidades) permanecem com `anon, authenticated, service_role`. Precedente: `clientes_risco` e `gestao_listas` já são `authenticated, service_role` apenas. | Validação usuário (opção A) |

## Decisões técnicas do plano v2 (rastreáveis ao Codex)

| # | Block CodeX do v1 | Endereçado pelo v2 |
|---|-------------------|---------------------|
| 1 | "New SECURITY DEFINER RPCs callable anonymously" | GRANT só `authenticated, service_role` nas 3 novas. Frontend autenticado confirmado (SEC-REVIEW Parte 1). |
| 2 | "MCP Supabase doesn't reach self-hosted VPS" | Phase 0 confirmou. v2 usa SSH + scp + docker exec + psql + NOTIFY pgrst. MCP descartado completamente. |
| 3 | "AC5 cross-check can't validate JSON RPC contract" | AC5 reescrito como extração JSON path. Query executável no ARCH-v2 §5. |
| 4 | "Historical exclusions violate reopened behavior" | Removidos os 2 NOT EXISTS (pedidos_dedup e crm_negocios Perdido). Regra = mesma do funil.oportunidades. Reaberto documentado como indetectável e aceito (opção A). |
| 5 | "Plan skips reconciliation of prerequisite DB contract" | Phase 0 resolveu: migrations v9/v6 ESTÃO aplicadas em prod, v8/v5 são superseded e versionadas no commit d6c4b7e. Drift zerado. |
| Bônus | "TIER FAST bypass deploy-gate.sh" | Phase 0 §10 confirmou: arquivo `deploy-gate.sh` NÃO EXISTE na VPS. Achado local apenas. Fica como ticket para @devops decidir se corrige repo local (não bloqueia v2). |

## Achados críticos do Phase 0 (read-only na VPS)

1. **6 RPCs vigentes**: `rpc_acoes_bi` (v9, 14.219 chars), `rpc_acoes_funil_gestao` (v6, 13.213), `rpc_acoes_gestao_listas` (10.739), `rpc_acoes_mapa_oportunidades` (4.810), `rpc_acoes_detalhe` (v6, 4.431), `rpc_acoes_clientes_risco` (3.549). Todas SECURITY DEFINER como postgres.
2. **`funil` retorna JSON** com `funil.oportunidades=112`, `funil.visitas=546`, `funil.ganhos=26`, `funil.perdidos=7` para julho/2026. Estrutura: `{funil: {...}, rankingConsultores: [...], diasParados: {...}, meta: {...}}`.
3. **GRANT anon EXECUTE em 4/6 RPCs** (bi, funil_gestao, mapa, detalhe). 2 já são `authenticated, service_role` apenas (precedente).
4. **Sem histórico de `ngo_conclusao`**. Único trigger em crm_negocios é `trg_auto_sync_metadata_crm_negocios` (sync metadata, não auditoria). Sem `crm_negocios_historico`. Distribuição atual: Em Andamento 2928, Ganho 827, Perdido 808.
5. **PostgREST reload via `NOTIFY pgrst, 'reload schema'` funciona** (testado no container).
6. **Deploy end-to-end**: SSH → `docker ps --filter name=supabase_db` → `scp migration.sql root@178.238.235.203:/tmp/` → `docker exec <container> psql -U postgres -d postgres -f /tmp/migration.sql` → `pg_get_functiondef` para verificar → `NOTIFY pgrst, 'reload schema'` para PostgREST enxergar.
7. **Bug do acento** `REPASSE DE MÁQUINA` vs `REPASSE DE MAQUINA` na CTE `parados` do funil v6 — FORA do escopo v2, mereceria migration própria.
8. **`diasParados` usa dedup diferente** das outras CTEs (`ngo_datacadastro` vs `ngo_dataatualizacao`). Unificar mudaria 112 → 111 em julho. Fora do escopo v2.

## Plano de implementação refinado

### FASE 1B — Banco (3 migrations, ADITIVAS)
- `supabase/migrations/20260803_rpc_acoes_pedidos_ganhos_v1.sql` (Story 4-A)
- `supabase/migrations/20260803_rpc_acoes_negocios_perdidos_v1.sql` (Story 4-B)
- `supabase/migrations/20260803_rpc_acoes_em_andamento_v1.sql` (Story 5-A)

Cada uma com:
- `CREATE OR REPLACE FUNCTION` com assinatura idêntica ao funil v6
- CTEs copiadas BYTE A BYTE de `20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql` (linhas exatas no ARCH-v2 §2.2)
- `RETURNS json` com `{rows: [...], total: N}`
- `GRANT EXECUTE TO authenticated, service_role` (SEM anon)
- `COMMENT ON FUNCTION` declarando: (a) fonte, (b) regra de dedup, (c) ausência de distinção de reaberto, (d) AC5 esperado contra funil

Deploy via SSH + docker exec + psql + NOTIFY pgrst (Phase 0 §9 documentou end-to-end).

### FASE 2 — Frontend
- Extrair `AcoesDegrauBar.tsx` (Story 1-A) ANTES de reusar para Ganho/Perdido
- Reescrever `AcoesDesfechosPeriodo.tsx` como wrapper fino (≤60 ln) com 2 `AcoesDegrauBar`
- Remover aba `sem_contato` de `AcoesGestaoCarteira.tsx` + deletar `AcoesGestaoCarteiraSummary.tsx` (Story 2-A)
- Aplicar Story 3-A (Desperdício) conforme `UX-DesperdicioV2.md` Opção D
- Criar `AcoesPedidosTable.tsx` ≤150 ln + `usePedidosGanhosRpc.ts` (Story 4-A)
- Criar `AcoesNegociosPerdidosTable.tsx` ≤150 ln + `useNegociosPerdidosRpc.ts` (Story 4-B)
- Criar `AcoesEmAndamentoTable.tsx` ≤150 ln + `useEmAndamentoRpc.ts` (Story 5-A)
- Routing em `AcoesDetailWithFilter.tsx` por `statusNegocio`
- Chip "Em Aberto" → "Em Andamento"

### FASE 3 — Gates
- @reviewer: DRY, monolito >300 = FAIL, dead code, separação lógica/UI
- @qa: smoke em banco vivo via SSH (não MCP). Validação cruzada AC5. Regressão.

---

## Perguntas que quero que o Codex responda (escopadas)

1. **A regra simplificada de `rpc_acoes_em_andamento`** (sem EXISTS adicional, apenas `ngo_conclusao='Em Andamento' + ngo_funil <> REPASSE + JOIN filtered`) — você concorda que é a implementação correta da decisão A do usuário? Tem algum caso edge que essa regra simples quebra?

2. **AC5 como `(funil.data->'funil'->>'oportunidades')::int == (em_andamento.data->>'total')::int`** é o teste certo? O funil retorna `json` puro (não é tabela). A RPC nova retorna `{rows: [...], total: N}`. As duas extrações JSON path são estáveis?

3. **GRANT `TO authenticated, service_role` (sem `anon`) nas 3 RPCs novas** — você concorda com a decisão do usuário (revoga só das novas, preserva das 4 existentes)? Há risco de inconsistência entre as 4 RPCs legíveis anônimamente e as 3 novas autenticadas?

4. **Deploy end-to-end via SSH + scp + docker exec + psql + NOTIFY pgrst** — você concorda que essa é a cadeia correta? Falta alguma etapa que devo adicionar (ex: backup antes, smoke em staging antes)?

5. **Riscos remanescentes não mapeados** pelo plano v2. Itens fora do escopo v2 (reportados no ARCH-v2 §6): bug do acento REPASSE, `diasParados` dedup diferente, GRANT anon das 4 existentes. Faz sentido tratar todos em migration própria? Ou só os 2 primeiros, deixando GRANT anon das 4 existentes para um próximo ciclo?

6. **Story 3-A (Desperdício)** — você revisaria o redesign do @ux (Opção D, InlineBar + badge NULL)? Tem contra-proposta?

7. **Ordem de implementação** (1-A extrair Degrau → 2-A remover sem_contato → 4-A pedidos + 4-B perdidos em paralelo → 5-A em_andamento por último) — você mudaria a ordem? Alguma dependência oculta?

8. **Critério de merge / DoD** — o que faltaria para você aprovar como DONE? Sugestões de smoke runs adicionais?

9. **Cobertura de teste de ciclo de vida** sem histórico — faz sentido documentar testes de ciclo (Em Andamento → Ganho → Em Andamento) que PROVAM a limitação conhecida? Ou aceita documentar no doc de feature e seguir?

10. **Handoff do `@security`** diz GO condicional (CONCERNS). Você enxerga blockers que o `@security` não mapeou?

---

## Definition of Done (DoD) proposta

- [ ] 3 migrations aplicadas via SSH/deploy; funções verificadas via `pg_get_functiondef`
- [ ] Smoke test GRANT: `SET ROLE anon; SELECT rpc_acoes_pedidos_ganhos(...)` retorna `permission denied`. `SET ROLE authenticated;` retorna `200 OK`.
- [ ] Smoke test AC5: query JSON path retorna `funil_oportunidades=112, em_andamento_total=112, invariant_holds=true`
- [ ] Frontend: 6 cards visuais (5 stories) com build TS limpo + vitest verde
- [ ] @reviewer PASS estrutural
- [ ] @qa PASS runtime (smoke em banco vivo via SSH)
- [ ] Feature doc `docs/features/acoes-bi.md` atualizada com os 3 novos contratos de RPC
- [ ] Nenhuma mutação rodou em prod antes do seu OK
