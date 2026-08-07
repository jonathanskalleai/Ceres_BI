# Codex Review Pack v3 — /bi/acoes (correções pós-deploy v10)

## TL;DR (3 linhas)

Plano de 4 correções pós-deploy identificadas em runtime pelo usuário + 1 investigação. Tudo ZERO mutação até o Codex aprovar.

## 4 problemas a corrigir (com análise + solução proposta)

### Problema 1 — TypeError toLocaleString undefined em AcoesPedidosTable.tsx:13

**Análise:**
Stack real do usuário (console do browser):
```
TypeError: Cannot read properties of undefined (reading 'toLocaleString')
    at ga (AcoesSection-BAUxGRlb.js:11:23536)
    at AcoesSection-BAUxGRlb.js:11:26502
    at Array.map (<anonymous>)
```

Investigação no código:
- `AcoesPedidosTable.tsx:12-13`: `const brl = (v: number) => v.toLocaleString(...)` — assume `number` mas `PedidoDetalheRow.valorPedido` pode ser `null`/`undefined` (campo de JOIN com `crm_pedidos`, nem sempre populado).
- Chamada: linha 111: `{brl(row.valorPedido)}` — quando `row.valorPedido` é `undefined`, explode.
- **MESMO BUG** em `AcoesNegociosPerdidosTable.tsx:13` e `AcoesEmAndamentoTable.tsx:13`.

**Solução proposta:**
Tornar a função `brl` defensiva (igual a `AcoesEmAndamentoTable` já fez na linha 13: `v != null ? v.toLocaleString(...) : DASH`). Aplicar nas 3 tabelas:
```ts
const brl = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }) : DASH;
```

**Impacto:** 3 arquivos × 1 linha. Sem regressão (só adiciona fallback).

### Problema 2 — Chip "Em Aberto" → "Em Andamento" (renomeação)

**Análise:**
Mudança na Story 5-A em `AcoesDetailWithFilter.tsx`:
```ts
{ value: "Em Andamento", label: "Em Andamento" },  // antes: "Em Aberto"
```

Possíveis impactos:
- **A) URLs salvas/filtros em localStorage:** se algum consumidor antigo (inclusive browser do usuário) tem `statusNegocio="Em Aberto"` salvo em algum lugar, fica órfão.
- **B) NegocioFilterContext default:** verificar se `statusNegocio` inicia com valor padrão. Se `"Em Aberto"` é o default legado e ninguém reseta, vai ter estado inconsistente.
- **C) Backend:** nenhuma RPC filtra por `statusNegocio` (vem de `mirror.crm_negocios.ngo_conclusao`). O chip "Em Aberto" provavelmente mapeava para `ngo_conclusao = 'Em Andamento'` (paralelo entre o que a UI chama e o que o banco chama). Se o rename quebrou esse mapeamento, perderíamos funcionalidade.

**A investigar:**
1. `src/contexts/NegociosFilterContext.tsx` — qual o default de `statusNegocio`?
2. Algum lugar em `localStorage` que persista `statusNegocio`?
3. `rpc_acoes_detalhe` (a usada pelo chip legacy `Em Aberto` no v9) — ela já aceitava `ngo_conclusao='Em Andamento'` como filtro?

**Solução proposta (após investigação):**
- Se o chip "Em Aberto" era alias de "Em Andamento", o rename é puro cosmético — OK.
- Se tinha significado diferente (ex: ações concluídas no período que tocam negócios em andamento), precisa documentar e talvez manter os 2 nomes.
- Adicionar migration de compat: se algum estado salvo tem `statusNegocio="Em Aberto"`, normalizar para "Em Andamento" no boot.

### Problema 3 — Reiniciar container a cada deploy

**Análise:**
`deploy.sh` linha 38-39:
```bash
sudo docker stack deploy -c docker-stack.yml "${STACK_NAME}"
sudo docker service update --image "${IMAGE_TAG}" --force "${STACK_NAME}_web"
```

O `service update --force` mata e recria o container. Investigação:
- **A) Custo:** ~30-60s de indisponibilidade a cada deploy.
- **B) Sessões:** se o usuário está autenticado e o deploy cai no meio de uma request, ele perde contexto (mas o `persistSession: true` faz ele relogar).
- **C) Cache do React Query:** o `staleTime: 5*60_000` significa que o frontend mantém cache por 5 min. Quando o container reinicia, queries em flight abortam mas o cache local ainda serve os dados por um tempo.

**Soluções possíveis:**
1. **Manter como está** — padrão da indústria, simplicidade. Risco zero de inconsistência entre imagem nova e antiga.
2. **Rolling update sem `--force`** — usar `docker service update --image` sem `--force` (deixar Swarm fazer rolling natural). Mas Swarm só faz rolling se a tag mudar (`:latest` não muda digest); por isso o `--force` é necessário.
3. **Tag versionada em vez de `:latest`** — `ceresbi:2026-08-03-v10-fix1`. Permite rolling update nativo do Swarm sem `--force`.
4. **Invalidação automática de cache do frontend após deploy** — após deploy, o frontend faz `queryClient.invalidateQueries()` ou tem `staleTime: 0` por 5 minutos.

**Recomendação:** solução (3) — tags versionadas. Pequena mudança no `deploy.sh` + `docker-stack.yml`. Custo baixo, ganho alto em resiliência.

**Investigação adicional:**
- Vale a pena adicionar healthcheck pré-deploy no script (esperar 1 réplica healthy antes de matar a outra)?
- Vale adicionar invalidação de staleTime após deploy?

### Problema 4 — "Recap" / memória apareceu na tela

**Investigação (NÃO há "recap" no código Ceres_BI):**
- `grep -r "recap\|Recap" src/` → 0 hits relevantes.
- `grep -r "localStorage" src/` → 5 hits:
  - `src/integrations/supabase/client.ts:13`: `storage: localStorage` (Supabase Auth persiste JWT)
  - `src/components/bi/debug/BiDebugOverlay.tsx:11`: `localStorage.getItem("bi_debug") === "true"` (debug overlay)
  - `src/hooks/useTheme.ts:9,40,54`: tema dark/light persistido
- Não há nenhum componente "Recap" no código.

**Hipóteses do que apareceu na tela:**
1. **Chrome autofill de formulário de login** — `persistSession: true` + localStorage = browser lembra email/senha. **Mais provável.**
2. **Algum widget nativo do browser** (Chrome tem "Recap" no histórico de tabs em alguns contextos)
3. **Algum componente de "Recent" / "Histórico"** que veio de package não rastreado

**A confirmar com você (Codex):**
- Pode ser algo que aparece SÓ na sua máquina local (dev tools, extensão)?
- Tem screenshot?
- Aparece em qual contexto — modal? sidebar? notificação?

**Sem investigação extra do código**, a hipótese mais provável é (1) autofill do Chrome no form de login. Não é bug do nosso código, mas pode ser resolvido adicionando `autoComplete="off"` no form de login OU forçando `supabase.auth.signInWithPassword` a usar token em vez de localStorage.

## Veredito @security-v4 / @reviewer / @qa (já validados)

Os fixes 1, 2 e 3 são:
- 1: 3 linhas (defensiva), sem risco
- 2: documentação + migration opcional
- 3: mudança no deploy.sh (já validado pelo Codex #3)

O fix 4 depende da confirmação do que é.

## Plano de implementação (proposto, espera aprovação Codex)

### Fase 1 — Fix bug (Problema 1) [5 min]
- Editar `AcoesPedidosTable.tsx:13` (defensiva)
- Editar `AcoesNegociosPerdidosTable.tsx:13` (defensiva)
- Editar `AcoesEmAndamentoTable.tsx:13` (já feito? verificar)
- Commit + push + deploy
- Smoke: clicar chip Perdido em /bi/acoes

### Fase 2 — Análise chip rename (Problema 2) [10 min]
- Investigar `NegociosFilterContext` default
- Verificar se algum consumer (BI Overview, Dashboard) usa `statusNegocio="Em Aberto"`
- Decidir: rename cosmético OK ou precisa migration de compat

### Fase 3 — Deploy sem restart forçado (Problema 3) [30 min]
- Investigar `docker-stack.yml`
- Propor tag versionada (recomendação Codex #3 confirmou)
- Atualizar `deploy.sh` para usar tag versionada
- Testar rolling update nativo

### Fase 4 — Recap (Problema 4) [investigação]
- Esperar resposta do usuário: o que exatamente apareceu
- Se autofill do Chrome: documentar workaround (`autoComplete="off"` no form)
- Se outra coisa: investigar

## O que NÃO fazer antes do Codex aprovar

- ❌ Não commitar nada
- ❌ Não mexer no deploy.sh
- ❌ Não deployar nada
- ❌ Não abrir PR

## Perguntas pro Codex

1. **Fix 1 (defensiva brl):** Você concorda com `v != null ? toLocaleString : DASH` ou prefere outra abordagem (ex: zero no lugar de DASH)?
2. **Fix 2 (chip rename):** Você acha que precisa de migration de compat (statusNegocio="Em Aberto" → "Em Andamento" no boot) ou o rename é puro cosmético?
3. **Fix 3 (deploy.sh):** Tag versionada (ceresbi:YYYY-MM-DD-N) é a melhor solução? Ou prefere manter `:latest` + `--force` mas adicionar healthcheck?
4. **Fix 4 (recap):** Sem o usuário confirmar o que é, dá pra eliminar a hipótese (1) (autofill do Chrome) sem ver? Ou você prefere esperar o screenshot do usuário antes de opinar?
5. **Riscos não mapeados:** Tem algum cenário onde esses fixes combinados quebram algo que ainda não está coberto?
6. **Critérios de merge/DOD:** O que precisa acontecer pra você aprovar?
