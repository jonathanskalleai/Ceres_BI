# AIVOUX — Pipeline Integrity (F6): o pipeline e INQUEBRAVEL

Resposta ao padrao de falha F6 — **pipeline ignorado por decisao propria da IA**
(incidente real, 2026-07-04): @reviewer e @qa falharam com 529 na Fase 1 e o
agente assumiu os papeis inline SEM AVISAR; na Fase 2 nem tentou spawnar — foi
do codigo direto pro deploy. O @scribe nunca rodou. Consequencia concreta: bug
real (`retry-failed` incapaz de reprocessar `whatsapp_send_media` porque o
`request_payload` nao carrega o base64) chegou em producao sem ser detectado —
o @qa teria pego.

Causa raiz: o pipeline era prosa. Dependia do orquestrador LEMBRAR — e com
contexto longo, compactacao ou falha de API, ele nao lembra. Esta rule torna o
pipeline **mecanico**: hooks deterministas (ver tabela abaixo) que nao dependem de memoria nem de
o Smart Router estar orquestrando a sessao.

Owner: **router/orquestrador** (processo) + hooks (enforcement).
Aplica-se a TODA sessao — inclusive sessao direta SEM router.

---

## Regra de Ouro

> O pipeline (dev → reviewer → qa → scribe → devops) so pode ser pulado por
> UMA pessoa: **o usuario, com autorizacao explicita nesta conversa.**
> Falha de API, contexto longo, "e so uma extensao da fase anterior",
> yolo_mode, pressa — NADA disso e autorizacao.

---

## As 10 Regras

### 1. Subagente falhou ≠ pular etapa

Quando um `Agent(subagent_type="aivoux-*")` falha (529, timeout, erro):

1. **Retry 1x** (falha transiente e comum)
2. Falhou de novo → **PARAR e reportar ao usuario** com opcoes:
   `1. tentar de novo, 2. aguardar e retomar, 3. autorizar execucao inline degradada`
3. **NUNCA assumir o papel do subagente silenciosamente.** Se o usuario
   autorizar inline: todo output daquela etapa e marcado **`INLINE_DEGRADED`**
   — no ▣, no ✓ e no handoff. INLINE_DEGRADED **nunca vira PASS**: no maximo
   CONCERNS, listando o que NAO foi verificado, e fica registrado para
   re-validacao quando os subagentes voltarem.

### 2. Hard gate de deploy (mecanico — `deploy-gate.sh`)

`git push`, `gh pr create/merge`, `gh release`, deploys de plataforma
(vercel/netlify/fly/wrangler/railway/supabase functions/docker push/kubectl
apply) e MCP (`deploy_edge_function`, `apply_migration`) sao **BLOQUEADOS**
(PreToolUse, exit 2) a menos que:

- `.aivoux/gates/qa-verdict.json` exista com `verdict: PASS|WAIVED` e
  `sha` == HEAD (commits pos-verdict docs-only, ex: @scribe, sao tolerados)
- `.aivoux/gates/agents-run.log` comprove **spawn real** de `aivoux-qa` apos o
  commit validado (verdict escrito inline sem spawnar @qa NAO passa — Regra 1)
- `.aivoux/gates/reviewer-verdict.json` exista com `verdict: PASS|WAIVED` e
  `sha` ancorado + spawn real de `aivoux-reviewer` (Regra 9 — @reviewer e
  obrigatorio em TODO pipeline que toca codigo, inclusive SIMPLE)
- Todo slug em `regression_gate.critical_paths` tenha secao `## Smoke` em
  `docs/features/{slug}.md` (Regra 6)

Isencao automatica: range a publicar e docs-only (`docs/`, `.aivoux/`,
`.claude/`, `*.md`). Typo/docs nao exigem pipeline.

### 3. Cada deploy = pipeline nova

"Mesmo padrao da fase anterior, so outro arquivo" NAO herda o PASS anterior.
O gate mecanico implementa isso: qualquer commit de codigo alem do SHA
validado invalida o verdict. Excecoes: docs-only, ou hotfix com autorizacao
explicita do usuario (override, Regra abaixo).

### 4. yolo_mode ≠ skip_pipeline

`yolo_mode: true` significa **apenas** "nao pausar para confirmacao entre
etapas". TODOS os agentes do pipeline rodam do mesmo jeito, na mesma ordem.
Interpretar yolo como licenca para pular etapa e violacao direta desta rule.

### 5. Fallback degradado e explicito, nunca silencioso

Tudo que rodou fora do fluxo normal aparece no fechamento:
- Etapa inline autorizada → `INLINE_DEGRADED` + lista do que nao foi verificado
- @scribe falhou → `DOCS_PENDING` no ✓ + TODO para a proxima sessao
- Afetada sem smoke → `SEM_SMOKE` no handoff (ja era regra do F4)
Silencio sobre degradacao = a proxima sessao opera sobre estado falso.

### 6. critical_paths DEVEM ter `## Smoke`

Feature em `regression_gate.critical_paths` sem secao `## Smoke` na doc =
regression gate e teatro (roda e nunca falha). O `deploy-gate.sh` **bloqueia
push/deploy** enquanto houver critical_path sem smoke registrado. Registrar
via @scribe (apos @qa PASS) ou `/aivoux/discover`.

### 7. Regra eliminada — scribe-gate.sh removido

O gate mecanico `scribe-gate.sh` foi removido. A documentacao de features
continua sendo recomendada apos @qa PASS, mas nao e mais imposta via hook
de parada.

### 8. Feature-Docs Lookup antes do primeiro spawn (mecanico — `docs-gate.sh`)

Incidente real: o router pulou a leitura de `docs/features/index.md` porque
seguiu o RESUMO desatualizado do CLAUDE.md em vez do router.md canonico — os
subagentes trabalharam sem a memoria do projeto. Correcao em duas pontas:

- **Gate:** se o projeto TEM `docs/features/index.md`, spawn de qualquer
  `aivoux-*` (exceto `aivoux-scribe`) e BLOQUEADO ate o index ser lido na
  janela atual. O `docs-lookup-trace.sh` (PostToolUse Read|Bash) grava o
  marker `.aivoux/gates/docs-lookup` automaticamente quando qualquer
  Read/Bash toca o index — ler o arquivo JA destrava (TTL 60min).
  Projeto sem index = lookup "nenhum", gate silencioso.
- **Precedencia:** o bloco AIVOUX do CLAUDE.md e um RESUMO. Em divergencia
  entre resumo e `.claude/commands/aivoux/router.md` / `.claude/rules/*`,
  **o router/rules VENCEM** — resumo desatualizado nao autoriza pular passo.

### 9. @reviewer e obrigatorio em TODO pipeline de codigo (mecanico — `review-gate.sh`)

Decisao de produto (2026-07): o @reviewer pega defeito estrutural real com
frequencia; pular ele em demanda "SIMPLE" economiza 1 spawn e custa retrabalho.
Complexidade muda SO a composicao do planejamento (pm/discussion) — NUNCA
remove gate de qualidade. Enforcement em dois pontos:

- **`review-gate.sh` (PreToolUse Task/Agent):** spawn de `aivoux-qa` e
  BLOQUEADO se o ultimo spawn de agente que produz codigo (`aivoux-dev` /
  `aivoux-data-engineer`, janela 24h) nao foi seguido por spawn de
  `aivoux-reviewer` (fonte: `agents-run.log`, deterministico).
- **`deploy-gate.sh`:** exige `reviewer-verdict.json` com PASS|WAIVED ancorado
  ao SHA + spawn real de `aivoux-reviewer` (mesmas regras do qa-verdict).

Override: `skip-review-authorized` — SO com autorizacao explicita do usuario,
uso unico, auditado. Ao consumir, o gate grava `reviewer-verdict.json` WAIVED
(agent `user-override`) para o deploy-gate reconhecer.

### 10. Plan-First — nenhuma implementacao sem plano (mecanico — `plan-gate.sh`)

Padrao de falha F7 — **fix na naba**: bug/feature analisado e corrigido direto,
sem planejar a solucao. O diff sobe, funciona no caso testado, e gera OUTRO erro
porque ninguem pensou no blast radius, nos arquivos tocados, nem em como validar.
O diagnostico (PASSO 1) entende o PROBLEMA; o plano (PASSO 2.5) desenha a SOLUCAO
— sao coisas diferentes, e o framework pulava a segunda.

- **`plan-gate.sh` (PreToolUse Task/Agent):** spawn de `aivoux-dev` /
  `aivoux-data-engineer` (os agentes que MUTAM) e BLOQUEADO ate existir
  `.aivoux/gates/plan.md` valido: ancorado ao HEAD (sha == HEAD ou ancestral —
  tolera o loop dev<->reviewer), fresco (< 90 min), e com as 5 secoes
  obrigatorias `## Abordagem` / `## Arquivos` / `## Risco / Blast` /
  `## Suposicao mais fraca` / `## Validar` preenchidas com conteudo nao-trivial
  (anti-teatro). Planejadores (architect/pm/analyst/ux), review
  (reviewer/security), qa e scribe NAO sao gateados — nao implementam.
- **Peso escalavel:** o plano existe SEMPRE, mas SIMPLE = 4 linhas (~1 min) e
  MEDIUM+ CONSOLIDA a saida do Discussion Mode / @architect (nao e etapa nova).
  Complexidade muda o TAMANHO do plano, nunca o remove.
- **Limite honesto:** o gate garante que UM plano com substancia existe, nao que
  o plano e BOM — a qualidade vem do @architect/Discussion e da honestidade
  brutal. O gate e o piso (nao implementar as cegas), nao o teto.

Override: `skip-plan-authorized` — SO com autorizacao explicita do usuario, uso
unico, auditado. Detalhes em `plan-first.md`.

---

## Os 8 hooks (enforcement deterministico)

| Hook | Evento | Funcao |
|------|--------|--------|
| `agent-trace.sh` | PostToolUse (Task/Agent) | grava `epoch subagent_type` em `.aivoux/gates/agents-run.log` — fonte de verdade de quem RODOU |
| `deploy-gate.sh` | PreToolUse (Bash + MCP deploy) | BLOQUEIA push/PR/deploy sem QA PASS ancorado ao SHA + spawn real de @qa + smokes de critical_paths |
| `security-gate.sh` | PreToolUse (Bash + MCP deploy) | BLOQUEIA push/PR/deploy CONDICIONALMENTE (so se o diff toca superficie sensivel) sem verdict SECURE do @security ancorado ao SHA + spawn real de aivoux-security |
| `docs-lookup-trace.sh` | PostToolUse (Read/Bash) | grava marker `docs-lookup` quando `docs/features/index.md` e lido |
| `docs-gate.sh` | PreToolUse (Task/Agent) | BLOQUEIA spawn de aivoux-* sem Feature-Docs Lookup quando o projeto tem index (Regra 8) |
| `review-gate.sh` | PreToolUse (Task/Agent) | BLOQUEIA spawn de aivoux-qa sem spawn de aivoux-reviewer apos o ultimo agente de codigo (Regra 9) |
| `plan-gate.sh` | PreToolUse (Task/Agent) | BLOQUEIA spawn de aivoux-dev/aivoux-data-engineer sem `.aivoux/gates/plan.md` valido ancorado ao HEAD (Regra 10) |

Estado em `.aivoux/gates/` (gitignored — e sessao-local, verdict de uma
maquina nao vale em outra):

```
.aivoux/gates/
  agents-run.log             # escrito pelo agent-trace.sh (hook)
  plan.md                    # escrito pelo router (PASSO 2.5) — plano da solucao (Regra 10)
  qa-verdict.json            # escrito pelo @qa ao emitir verdict
  reviewer-verdict.json      # escrito pelo @reviewer ao emitir verdict (Regra 9)
  security-verdict.json      # escrito pelo @security ao emitir verdict (gate condicional)
  docs-lookup                # escrito pelo docs-lookup-trace.sh ao ler o index (Regra 8)
  docs-na                   # reservado (era escape do scribe-gate, agora disponivel)
  skip-pipeline-authorized   # override de USO UNICO do deploy-gate — so com autorizacao do usuario
  skip-security-authorized   # override de USO UNICO do security-gate — so com autorizacao do usuario
  skip-review-authorized     # override de USO UNICO do review-gate — so com autorizacao do usuario
  skip-plan-authorized       # override de USO UNICO do plan-gate — so com autorizacao do usuario
  overrides.log              # auditoria de todo override consumido
```

### `qa-verdict.json` (escrito pelo @qa, ultimo ato do review)

```json
{
  "sha": "<git rev-parse HEAD no momento do verdict>",
  "verdict": "PASS|CONCERNS|FAIL|WAIVED",
  "agent": "aivoux-qa",
  "timestamp": "<ISO-8601 UTC>",
  "scope": "<1 linha: o que foi validado>"
}
```

### `reviewer-verdict.json` (escrito pelo @reviewer, ultimo ato do review estrutural)

```json
{
  "sha": "<git rev-parse HEAD no momento do verdict>",
  "verdict": "PASS|FAIL|WAIVED",
  "agent": "aivoux-reviewer",
  "timestamp": "<ISO-8601 UTC>",
  "scope": "<1 linha: o que foi auditado>"
}
```

### `security-verdict.json` (escrito pelo @security, quando roda o gate condicional)

```json
{
  "sha": "<git rev-parse HEAD no momento do verdict>",
  "verdict": "SECURE|CONCERNS|VULNERABLE|WAIVED",
  "agent": "aivoux-security",
  "timestamp": "<ISO-8601 UTC>",
  "scope": "<1 linha: superficie auditada — NUNCA o valor de um segredo>"
}
```

O `security-gate.sh` so exige este arquivo quando o range a publicar toca
superficie sensivel (deteccao heuristica por path + conteudo do diff). Mudanca
nao-sensivel passa sem verdict de seguranca — o gate e condicional de proposito
(seguranca profunda e situacional; @qa check #4 e a rede rasa). `VULNERABLE`
bloqueia; falso positivo da heuristica → override `skip-security-authorized`.

### Override (`skip-pipeline-authorized`)

So existe UM caminho legitimo para pular o gate: o usuario autorizou
EXPLICITAMENTE nesta conversa. Nesse caso (e somente nesse), criar o arquivo
com a **citacao literal** da autorizacao dentro. O gate consome o arquivo
(uso unico) e registra em `overrides.log`. Criar o override sem autorizacao
do usuario e violacao da mesma gravidade que contornar o delete-guard.

---

## Anti-padroes (cada um aconteceu no incidente real)

- ❌ Subagente deu 529 → assumir o papel inline e seguir como se nada
- ❌ "Ja aprendi que posso fazer sozinho" — Fase 2 sem nem tentar spawnar
- ❌ Interpretar `yolo_mode: true` como "posso pular reviewer/qa"
- ❌ Tratar continuacao ("Fase 2") como extensao que herda o PASS da Fase 1
- ❌ Deploy declarado DONE sem nenhum verdict de @qa para aquele SHA
- ❌ Encerrar sessao com @qa PASS e entrega sem documentacao registrada (memoria do projeto nao registra a entrega)
- ❌ Criar `skip-pipeline-authorized` sem o usuario ter autorizado (fraude de gate)

---

## Integracao

- `router.md` PASSO 3.e — protocolo de falha de spawn (Regra 1)
- `router.md` PASSO 2.5 — router escreve `plan.md` antes de dev/data-engineer (Regra 10)
- `plan-first.md` (F7) — Plan-First detalhado: template do plano + peso escalavel
- `agents/qa.md` — @qa grava `qa-verdict.json` como ultimo ato do review
- `agents/reviewer.md` — @reviewer grava `reviewer-verdict.json` (Regra 9)
- `agents/security.md` — @security grava `security-verdict.json` (gate condicional)
- `security-standards.md` — enforcement via @security (2 niveis: @qa raso + @security profundo)
- `agents/devops.md` — pre-push gate ja valida; o hook e a rede que nao esquece
- `regression-gate.md` (F4) — Regra 6 da dentes ao gate de smoke
- `deploy-safety.md` (F1) — este gate roda ANTES (nem deixa o push sair);
  F1 valida DEPOIS (boot + smoke no ambiente vivo)
- `shared-config.md` — quality gates #18/#19
