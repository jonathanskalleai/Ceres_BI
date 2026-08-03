# AIVOUX — Regression Gate (F4): blast radius + smoke dos vizinhos

Resposta ao padrao de falha F4 — **regressao silenciosa**: o fix/feature novo
funciona, todos os gates passam, mas a mudanca quebrou OUTRA coisa que ja
funcionava (mexeu no util compartilhado do atendimento e o webhook parou;
alterou um schema e o dashboard zerou). O usuario descobre em producao.

Por que os gates atuais nao pegam: quality gate valida o DIFF (lint, build,
gate de tamanho); @qa valida runtime DA MUDANCA; deploy-safety valida boot + smoke
DO QUE FOI TOCADO. Ninguem re-verifica os **vizinhos** — e em projeto
vibe-coded `npm test` passa vazio porque quase nao ha testes.

Owner: **router** (computa o raio) + **@qa** (executa smokes, veredicto).
Suporte: **@scribe** (mantem `## Smoke` nas docs), **@devops** (re-smoke pos-deploy).

---

## Regra de Ouro

> A mudanca funcionar ≠ o resto continuar funcionando.
> Um LLM lendo o diff NAO prova ausencia de regressao — so execucao prova.
>
> **Nenhum pipeline que tocou codigo fecha sem blast radius computado
> e smokes das features afetadas executados (ou reportados como nao-verificaveis).**

---

## As 3 pecas

### 1. Blast radius (deterministico — script, nao opiniao)

`bash .claude/hooks/blast-radius.sh` — dado o diff:
- lista arquivos tocados (working tree + staged + untracked; ou `--base <ref>`)
- grep reverso: quem IMPORTA os arquivos tocados
- cruza tocados + importadores com `docs/features/*.md` → **features afetadas**
- marca cada afetada com `SMOKE_OK` ou `SEM_SMOKE`
- lista `critical_paths` do config (smoke roda SEMPRE, mesmo fora do raio)

READ-ONLY, custo ~zero. O router PODE rodar direto (PASSO 4). Output vai
integralmente no prompt do @qa.

### 2. Secao `## Smoke` nas feature docs (memoria executavel)

Cada `docs/features/{slug}.md` tem uma secao `## Smoke` com **1-3 passos
executaveis** que provam que a feature ainda funciona:

```markdown
## Smoke
- `curl -s -X POST localhost:3000/api/webhook -d @fixtures/msg.json` → 200 + msg persistida
- `npm test -- chat` → verde
```

Regras: cada linha e um comando/passo OBSERVAVEL com resultado esperado —
curl, teste, SELECT com valor esperado, fluxo Playwright. Nada de "verificar
se funciona". Quem escreve: @scribe (apos @qa PASS, com o smoke que o @qa
executou) e `/aivoux/discover` (semeia validando com o usuario).

### 3. Gate no @qa (check #8 — bloqueante)

Antes do verdict, @qa recebe o blast radius do router (ou roda o script) e:

1. Executa o `## Smoke` de CADA feature afetada (max `regression_gate.max_affected_smokes`)
2. Executa o `## Smoke` de cada `critical_paths` (sempre, mesmo fora do raio)
3. Reporta por feature: `PASS` | `FAIL` | `SEM_SMOKE`

Verdicts:
- Smoke de afetada **FALHOU** → verdict **FAIL** (se `block_on_smoke_fail: true`,
  default) — a regressao foi INTRODUZIDA por este diff; devolver ao @dev
- Afetada **SEM_SMOKE** → no maximo **CONCERNS**, com a linha explicita no
  handoff: `"regression: {slug} afetada e NAO verificavel (sem smoke)"` —
  **nunca silencio**. Sugerir registro do smoke ao usuario/@scribe.
- Tudo PASS → seguir para verdict normal

---

## Config (`.aivoux/config.yaml`)

```yaml
regression_gate:
  enabled: true
  script: .claude/hooks/blast-radius.sh
  max_affected_smokes: 5
  block_on_smoke_fail: true
  critical_paths: []   # slugs "coracao" do projeto — ex: [atendimento-whatsapp]
```

`critical_paths` e a lista de features que o negocio NAO tolera quebradas
(pipeline de mensagens, checkout, auth). Smoke delas roda em TODO pipeline
que toca codigo. Preencher no onboarding do projeto (ou via /aivoux/discover).

**Teeth mecanico (F6):** critical_path SEM secao `## Smoke` na doc = regression
gate e teatro (roda mas nunca falha). O `deploy-gate.sh` **BLOQUEIA push/deploy**
enquanto houver critical_path sem smoke registrado — nao e mais so recomendacao.
Vide `pipeline-integrity.md` Regra 6.

---

## Deploy (extensao do deploy-safety.md)

No pipeline DEPLOY, apos boot check + smoke da mudanca, @devops re-executa os
smokes das features afetadas (blast radius `--base` do ultimo deploy quando
disponivel; senao `--last-commit`) + critical_paths **no ambiente vivo**.
Afetada quebrada pos-deploy = rollback (SHA anterior ja identificado pelo
gate 5 do deploy-safety).

---

## Limite honesto deste gate

O gate so cobre o que tem smoke registrado. Nas primeiras semanas a cobertura
sera parcial — isso e esperado e reportado (`SEM_SMOKE`), nunca escondido.
Cada regressao que escapar vira 1 linha nova de smoke na doc da feature
(fazer isso e parte do fix). O sistema aprende por acrescimo, igual F1/F2/F3:
preflight barato contra revert caro.

Anti-padroes:
- ❌ Spawnar agente para "olhar o diff e dizer se quebrou algo" sem executar nada
- ❌ @qa emitir PASS com afetada SEM_SMOKE omitida do handoff
- ❌ Escrever smoke nao-executavel ("conferir que o chat funciona")
- ❌ Pular o gate porque "a mudanca e pequena" — foi exatamente assim que o
  regex de 1 linha derrubou o worker

---

## Integracao

- Router PASSO 4: roda blast-radius ANTES de spawnar @qa e injeta o output
- @qa: check #8 (Regression) — vide `agents/qa.md`
- @scribe: secao `## Smoke` no template de feature doc
- `/aivoux/discover`: semeia smokes na FASE 3/4 (validados com o usuario)
- `deploy-safety.md`: re-smoke dos afetados no ambiente vivo
- Quality gate #14 em `shared-config.md`
