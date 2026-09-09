# AIVOUX — Regression Gate (F4): blast radius + smoke dos vizinhos

> **NOTA RUNTIME CODEX:** no Claude Code o blast radius e computado pelo hook/script
> `blast-radius.sh`. **O Codex nao roda hooks**; aqui o mesmo raio e computado
> MANUALMENTE pelo router/agente com `git diff` + grep reverso (passos abaixo). O
> objetivo e identico: nenhum pipeline que tocou codigo fecha sem checar os
> vizinhos.

Resposta ao padrao de falha F4 — **regressao silenciosa**: o fix/feature novo
funciona, todos os gates passam, mas a mudanca quebrou OUTRA coisa que ja
funcionava (mexeu no util compartilhado e o webhook parou; alterou um schema e o
dashboard zerou). O usuario descobre em producao.

Por que os gates atuais nao pegam: quality gate valida o DIFF; @qa valida runtime
DA MUDANCA; deploy-safety valida boot + smoke DO QUE FOI TOCADO. Ninguem
re-verifica os **vizinhos** — e em projeto vibe-coded `npm test` passa vazio
porque quase nao ha testes.

Owner: **router** (computa o raio) + **@qa** (executa smokes, veredicto).
Suporte: 

---

## Regra de Ouro

> A mudanca funcionar ≠ o resto continuar funcionando.
> Um LLM lendo o diff NAO prova ausencia de regressao — so execucao prova.
>
> **Nenhum pipeline que tocou codigo fecha sem blast radius computado
> e smokes das features afetadas executados (ou reportados como nao-verificaveis).**

---

## As 3 pecas

### 1. Blast radius (manual no Codex — deterministico, nao opiniao)

Sem `blast-radius.sh`, computar o raio a mao:

1. Arquivos tocados: `git diff --name-only HEAD` (+ staged + untracked).
2. Grep reverso — quem IMPORTA os arquivos tocados: para cada arquivo,
   `rg -l "nome-do-modulo"` pelo codebase.
3. Cruzar tocados + importadores com `docs/features/*.md` → **features afetadas**.
4. Marcar cada afetada com `SMOKE_OK` (tem secao `## Smoke`) ou `SEM_SMOKE`.
5. Somar os `regression_gate.critical_paths` do config (smoke roda SEMPRE, mesmo
   fora do raio).

READ-ONLY, custo baixo. O router faz isso e passa o resultado integral ao @qa.

### 2. Secao `## Smoke` nas feature docs (memoria executavel)

Cada `docs/features/{slug}.md` tem uma secao `## Smoke` com **1-3 passos
executaveis** que provam que a feature ainda funciona:

```markdown
## Smoke
- `curl -s -X POST localhost:3000/api/webhook -d @fixtures/msg.json` → 200 + msg persistida
- `npm test -- chat` → verde
```

Cada linha e um comando/passo OBSERVAVEL com resultado esperado — curl, teste,
SELECT com valor esperado, fluxo de UI. Nada de "verificar se funciona". Quem
escreve
`aivoux-discover` (semeia validando com o usuario).

### 3. Gate no @qa (check bloqueante)

Antes do verdict, @qa recebe o blast radius do router (ou computa) e:

1. Executa o `## Smoke` de CADA feature afetada (max `regression_gate.max_affected_smokes`)
2. Executa o `## Smoke` de cada `critical_paths` (sempre, mesmo fora do raio)
3. Reporta por feature: `PASS` | `FAIL` | `SEM_SMOKE`

Verdicts:
- Smoke de afetada **FALHOU** → verdict **FAIL** (se `block_on_smoke_fail: true`,
  default) — regressao INTRODUZIDA por este diff; devolver ao @dev
- Afetada **SEM_SMOKE** → no maximo **CONCERNS**, com a linha explicita no handoff:
  `"regression: {slug} afetada e NAO verificavel (sem smoke)"` — **nunca silencio**.
- Tudo PASS → seguir para verdict normal

---

## Config (`.aivoux/config.yaml`)

```yaml
regression_gate:
  enabled: true
  max_affected_smokes: 5
  block_on_smoke_fail: true
  critical_paths: []   # slugs "coracao" do projeto — ex: [atendimento-whatsapp]
```

`critical_paths` e a lista de features que o negocio NAO tolera quebradas
(pipeline de mensagens, checkout, auth). Smoke delas roda em TODO pipeline que
toca codigo. Preencher no onboarding (ou via `aivoux-discover`).

**Teeth (F6):** critical_path SEM secao `## Smoke` na doc = regression gate e
teatro. @devops NAO deve publicar enquanto houver critical_path sem smoke
registrado. Vide `pipeline-integrity.md` Regra 6.

---

## Deploy (extensao do deploy-safety.md)

No pipeline DEPLOY, apos boot check + smoke da mudanca, @devops re-executa os
smokes das features afetadas (`--base` do ultimo deploy quando disponivel; senao
o ultimo commit) + critical_paths **no ambiente vivo**. Afetada quebrada
pos-deploy = rollback (SHA anterior ja identificado no deploy-safety).

---

## Limite honesto deste gate

O gate so cobre o que tem smoke registrado. Nas primeiras semanas a cobertura
sera parcial — isso e esperado e reportado (`SEM_SMOKE`), nunca escondido. Cada
regressao que escapar vira 1 linha nova de smoke na doc da feature (parte do fix).

Anti-padroes:
- ❌ Pedir a um agente "olhar o diff e dizer se quebrou algo" sem executar nada
- ❌ @qa emitir PASS com afetada SEM_SMOKE omitida do handoff
- ❌ Escrever smoke nao-executavel ("conferir que o chat funciona")
- ❌ Pular o gate porque "a mudanca e pequena" — foi exatamente assim que o
  regex de 1 linha derrubou o worker

---

## Integracao

- `aivoux-router`: computa o blast radius ANTES do @qa e injeta o output
- @qa: check de Regression — vide `agents/qa.md`

- `aivoux-discover`: semeia smokes (validados com o usuario)
- `deploy-safety.md`: re-smoke dos afetados no ambiente vivo
- `shared-config.md`: quality gate de regressao
