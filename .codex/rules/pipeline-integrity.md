# AIVOUX — Pipeline Integrity (F6): o modo FULL e INQUEBRAVEL

> **NOTA RUNTIME CODEX (LEIA PRIMEIRO):** no Claude Code, TODO o enforcement
> desta rule e MECANICO — hooks (`deploy-gate.sh`, `review-gate.sh`,
> `security-gate.sh`, ``, `docs-gate.sh`, `agent-trace.sh`) que
> BLOQUEIAM de verdade, mesmo se a IA esquecer. **O Codex NAO executa hooks.**
> Aqui nada bloqueia mecanicamente: estas regras valem como obrigacao
> COMPORTAMENTAL absoluta do orquestrador/agente. Nao ha rede de seguranca —
> pular uma etapa no Codex nao dispara erro, so quebra o pipeline em silencio.
> Por isso a disciplina tem que ser ainda mais rigorosa que no Claude Code.
> Os arquivos `.aivoux/gates/*.json` continuam sendo escritos como registro e
> handoff entre etapas, nao como destravador de hook.

Resposta ao padrao de falha F6 — **pipeline ignorado por decisao propria da IA**
(incidente real, 2026-07-04): @reviewer e @qa falharam com 529 na Fase 1 e o
agente assumiu os papeis inline SEM AVISAR; na Fase 2 nem tentou spawnar — foi
do codigo direto pro deploy. O Consequencia concreta: bug
real chegou em producao sem ser detectado — o @qa teria pego.

Causa raiz: o pipeline era prosa. Dependia do orquestrador LEMBRAR — e com
contexto longo, compactacao ou falha de API, ele nao lembra. No Claude Code a
resposta foi tornar o pipeline mecanico via hooks. **No Codex a resposta e a
mesma disciplina, mas sem rede — cabe a voce nao pular etapa.**

Owner: **router/orquestrador** (processo).
Aplica-se a TODA sessao — inclusive sessao direta SEM router.

## Modos

- **DEVELOPMENT** (`*dev`, `*development`, alias `*fast`): itera sem
  `reviewer`, `security` e `qa`; registra codigo/schema em
  `pipeline_mode.pending_dir`. Branch/PR podem ser publicados, mas
  merge/release/producao exigem auditoria FULL.
- **FULL** (`*full`): executa `dev -> reviewer -> security` condicional `-> qa
  -> devops`, com verdicts ancorados ao SHA.

DEVELOPMENT e uma politica escolhida pelo usuario/config, nao uma falha de
integridade. O que continua proibido e afirmar FULL e pular etapa ou publicar
merge/release/producao sem promover as pendencias.

### Registro de pendencias

Quando DEVELOPMENT tocar codigo/schema, o ultimo agente de implementacao cria um
registro em `pipeline_mode.pending_dir` com `status: PENDING_REVIEW`, resumo curto,
agentes, arquivos e SHAs de referencia. Nao copie prompt integral, segredos ou
payloads sensiveis. `aivoux-audit pending` consolida os registros e, apos
reviewer/security condicional/QA com runtime, marca `APPROVED` ou `NEEDS_FIX`.

---

## Regra de Ouro

> No modo FULL, o pipeline (dev → reviewer → security condicional → qa → devops)
> so pode ser pulado por UMA pessoa: **o usuario, com autorizacao explicita nesta
> conversa.** No modo DEVELOPMENT, a ausencia desses gates e intencional e deve
> ficar registrada. Falha de API, contexto longo, yolo_mode e pressa nao mudam o
> modo nem autorizam mascarar uma etapa.

---

## As 9 Regras

### 1. Subagente/etapa falhou ≠ pular etapa

Quando uma etapa de agente falha (529, timeout, erro), ou o ambiente Codex nao
consegue rodar aquele agente:

1. **Retry 1x** (falha transiente e comum)
2. Falhou de novo → **PARAR e reportar ao usuario** com opcoes:
   `1. tentar de novo, 2. aguardar e retomar, 3. autorizar execucao inline degradada`
3. **NUNCA assumir o papel do agente silenciosamente.** Se o usuario autorizar
   inline: todo output daquela etapa e marcado **`INLINE_DEGRADED`** — no ▣, no ✓
   e no handoff. INLINE_DEGRADED **nunca vira PASS**: no maximo CONCERNS, listando
   o que NAO foi verificado, e fica registrado para re-validacao.

### 2. Gate de deploy (comportamental no Codex)

No modo FULL, `git push` em producao, `gh pr merge`, `gh release`, deploys de plataforma
(vercel/netlify/fly/wrangler/railway/supabase functions/docker push/kubectl
apply) NAO devem sair a menos que:

- `.aivoux/gates/qa-verdict.json` exista com `verdict: PASS|WAIVED` e `sha` == HEAD
  (commits pos-verdict docs-only, sao tolerados)
- O @qa TENHA REALMENTE rodado apos o commit validado (verdict escrito sem o @qa
  ter auditado NAO conta — Regra 1)
- `.aivoux/gates/reviewer-verdict.json` exista com `verdict: PASS|WAIVED` e `sha`
  ancorado (Regra 9 — @reviewer e obrigatorio em TODO pipeline de codigo,
  inclusive SIMPLE)
- Todo slug em `regression_gate.critical_paths` tenha secao `## Smoke` na doc (Regra 6)

Isencao: range a publicar e docs-only (`docs/`, `.aivoux/`, `.claude/`, `.codex/`,
`AGENTS.md`, `*.md`). Typo/docs nao exigem pipeline. No DEVELOPMENT, permita
somente push de branch que nao seja `main`/`master` e `gh pr create`; merge,
release, producao e deploy de plataforma exigem os verdicts FULL. **No Codex nao
ha hook para impedir o push — @devops e o gate comportamental.**

### 3. Cada deploy = pipeline nova

"Mesmo padrao da fase anterior, so outro arquivo" NAO herda o PASS anterior.
Qualquer commit de codigo alem do SHA validado invalida o verdict. Excecoes:
docs-only, ou hotfix com autorizacao explicita do usuario (override, Regra abaixo).

### 4. yolo_mode ≠ mode_selection

`yolo_mode: true` significa **apenas** "nao pausar para confirmacao entre etapas".
No FULL, todos os gates rodam na mesma ordem. No DEVELOPMENT, a ausencia de
reviewer/security/qa e intencional e registrada; yolo nao troca o modo.

### 5. Fallback degradado e explicito, nunca silencioso

Tudo que rodou fora do fluxo normal aparece no fechamento:
- Etapa inline autorizada → `INLINE_DEGRADED` + lista do que nao foi verificado
- 
- Afetada sem smoke → `SEM_SMOKE` no handoff (regra do F4)
Silencio sobre degradacao = a proxima sessao opera sobre estado falso.

### 6. critical_paths DEVEM ter `## Smoke`

Feature em `regression_gate.critical_paths` sem secao `## Smoke` na doc =
regression gate e teatro (roda e nunca falha). @devops NAO deve publicar enquanto
houver critical_path sem smoke registrado. Registrar via
ou `aivoux-discover`.

### 7. 



- SIMPLE sem doc relacionada → criar `.aivoux/gates/
- 

### 8. Feature-Docs Lookup antes do primeiro agente

Se o projeto TEM `docs/features/index.md`, LEIA o index ANTES de acionar qualquer
agente de trabalho — os agentes precisam da memoria do projeto. Projeto sem index
= lookup "nenhum". **Precedencia:** o bloco AIVOUX do AGENTS.md e um RESUMO. Em
divergencia entre resumo e `aivoux-router` / `.codex/rules/*`, **o router/rules
VENCEM** — resumo desatualizado nao autoriza pular passo.

### 9. @reviewer e obrigatorio em TODO pipeline FULL de codigo

Decisao de produto (2026-07): no modo FULL o @reviewer pega defeito estrutural
real com frequencia; pular ele em demanda "SIMPLE" economiza 1 etapa e custa
retrabalho. No DEVELOPMENT ele e deliberadamente adiado e aparece no registro
de pendencia. No Codex nao ha `review-gate.sh` — a obrigatoriedade do FULL e
comportamental.

Override: `skip-review-authorized` — SO com autorizacao explicita do usuario,
uso unico, auditado.

---

## Estado em `.aivoux/gates/` (registro/handoff — nao destrava hook no Codex)

```
.aivoux/gates/
  qa-verdict.json            # escrito pelo @qa ao emitir verdict
  reviewer-verdict.json      # escrito pelo @reviewer ao emitir verdict (Regra 9)
  security-verdict.json      # escrito pelo @security ao emitir verdict (gate condicional)
  pipeline-mode              # development|full, compartilhado entre harnesses
  
  overrides.log              # auditoria de todo override consumido pelo usuario
```

### `qa-verdict.json`

```json
{"sha": "<git rev-parse HEAD>", "verdict": "PASS|CONCERNS|FAIL|WAIVED",
 "agent": "aivoux-qa", "timestamp": "<ISO-8601 UTC>", "scope": "<1 linha>"}
```

### `reviewer-verdict.json`

```json
{"sha": "<git rev-parse HEAD>", "verdict": "PASS|FAIL|WAIVED",
 "agent": "aivoux-reviewer", "timestamp": "<ISO-8601 UTC>", "scope": "<1 linha>"}
```

### `security-verdict.json` (so quando o diff toca superficie sensivel)

```json
{"sha": "<git rev-parse HEAD>", "verdict": "SECURE|CONCERNS|VULNERABLE|WAIVED",
 "agent": "aivoux-security", "timestamp": "<ISO-8601 UTC>",
 "scope": "<1 linha: superficie auditada — NUNCA o valor de um segredo>"}
```

`VULNERABLE` bloqueia (volta ao @dev). Mudanca nao-sensivel nao exige verdict de
seguranca — o gate e condicional de proposito (@qa check #4 e a rede rasa).

### Override

So existe UM caminho legitimo para pular o pipeline: o usuario autorizou
EXPLICITAMENTE nesta conversa. Nesse caso (e somente nesse), registrar a citacao
literal da autorizacao em `overrides.log`. Criar override sem autorizacao do
usuario e violacao da mesma gravidade que deletar arquivo sem confirmacao.

---

## Anti-padroes (cada um aconteceu no incidente real)

- ❌ Etapa falhou → assumir o papel inline e seguir como se nada
- ❌ "Ja aprendi que posso fazer sozinho" — Fase 2 sem nem tentar rodar o agente
- ❌ Interpretar `yolo_mode: true` como troca silenciosa de DEVELOPMENT/FULL
- ❌ Tratar continuacao ("Fase 2") como extensao que herda o PASS da Fase 1
- ❌ Deploy declarado DONE sem nenhum verdict de @qa para aquele SHA

- ❌ Pular @reviewer no modo FULL "porque e SIMPLE"
- ❌ Marcar pendencia como `APPROVED` sem os gates FULL e runtime do @qa

---

## Integracao

- `aivoux-router` (skill) — orquestracao do pipeline + protocolo de falha (Regra 1)
- `agents/qa.md` — @qa grava `qa-verdict.json` como ultimo ato do review
- `agents/reviewer.md` — @reviewer grava `reviewer-verdict.json` (Regra 9)
- `agents/security.md` — @security grava `security-verdict.json` (gate condicional)
- `security-standards.md` — enforcement via @security (2 niveis: @qa raso + @security profundo)
- `regression-gate.md` (F4) — Regra 6 da dentes ao gate de smoke
- `deploy-safety.md` (F1) — boot + smoke no ambiente vivo apos publicar
- `shared-config.md` — quality gates
