# AIVOUX — Discover (Brownfield Deep Scan)

Escopo opcional: $ARGUMENTS

Workflow de ativacao MANUAL. Objetivo: mapear um projeto existente (tipicamente
brownfield que cresceu sem documentacao), **semear a memoria do projeto**
(`docs/features/*.md` + `index.md` + `.aivoux/infra.md`) com fatos VALIDADOS
pelo usuario, e produzir backlog de tech debt com evidencia de ferramenta.

Roda 1x por projeto; re-run apenas quando o projeto mudou muito ou para cobrir
areas faltantes. NAO e o context scan barato do router — e o scan profundo.

---

## Regras Absolutas

1. **READ-ONLY no codigo.** Este workflow NUNCA edita, move ou deleta codigo.
   Unico output permitido: arquivos de documentacao (`docs/`, `.aivoux/`).
2. **Duplicacao/dead code = evidencia de FERRAMENTA, nunca opiniao.** Sem
   ferramenta disponivel, o achado entra como `nao verificado por ferramenta`
   — jamais como afirmacao.
3. **Fato so vira doc depois de validado com o usuario (FASE 3).** Nao validado
   entra marcado `unverified`. Memoria contaminada com alucinacao e pior que
   memoria vazia — ela e injetada em toda demanda futura como se fosse verdade.
4. **Zero auto-limpeza.** Achados de tech debt viram backlog em
   `docs/tech-debt.md`; cada item vira demanda separada via `/aivoux/router`
   com pipeline e QA normais.
5. O usuario pode nao saber programar, mas conhece infra e o negocio. As
   perguntas da FASE 3 sao **claims concretas para confirmar/corrigir**, nunca
   "me explica como funciona X".

---

## FASE 0 — Preflight (baratissimo)

1. Ler `.aivoux/config.yaml` (bloco `discover`), `package.json`.
2. Se `docs/features/index.md` JA existe: perguntar ao usuario (AskUserQuestion)
   — re-scan completo ou apenas areas ainda sem doc? Nao sobrescrever doc
   validada sem confirmacao.
3. Medir tamanho: `git ls-files | wc -l`. Acima de ~2000 arquivos, avisar o
   custo e sugerir escopo por area (`$ARGUMENTS`) antes de prosseguir.

---

## FASE 1 — Scan Mecanico (deterministico, router faz direto)

Capturar, com timeout e degradacao graciosa (falhou → registrar "nao rodou" e
seguir; NUNCA travar o workflow por ferramenta ausente):

**Estrutura (sempre):**
- `git ls-files` (respeita .gitignore — nao usar tree/find cru)
- top-level dirs + contagem por extensao
- configs: scripts e deps do `package.json`, `tsconfig.json`, `next/vite config`,
  `docker-compose*`, `Dockerfile`, `supabase/` + migrations, `.env.example`
  (**NUNCA ler `.env` real**)

**Ferramentas (apenas projeto JS/TS; via `npx -y`, timeout 120s cada, sem
instalar nada no projeto):**
- `npx -y knip --reporter compact` → arquivos/exports nao usados
- `npx -y jscpd --min-tokens 50 --silent --reporters consoleFull {src dir}` → duplicacao literal
- `npx -y depcheck` → dependencias mortas

Projeto nao-JS ou ferramenta falhou: usar analise de referencias via Grep
(imports orfaos) e declarar o metodo no relatorio — com confianca menor.

---

## FASE 2 — Sintese (subagente)

Spawnar `aivoux-architect` com TODO o output da FASE 1:

```
Agent(subagent_type="aivoux-architect", prompt="
Output do scan mecanico: {fase 1}
Sua tarefa: produzir o MAPA DE AREAS do projeto — max {discover.max_areas}
areas funcionais. Para cada area:
- slug (kebab-case), proposito em 1 frase, entry points (paths reais)
- 2-4 CLAIMS verificaveis sobre como funciona/roda, especificas o bastante
  para o usuario responder confere/nao confere
  (ex: 'o ETL roda via cron na VPS lendo de X e gravando na tabela Y')
Separar em bloco proprio as CLAIMS DE INFRA (hosts, portas, como servicos
rodam, DB ativo, deploy). Leia apenas entry points e configs — nao o projeto
inteiro. NAO adivinhe: claim sem evidencia no codigo = nao escrever.")
```

---

## FASE 3 — Validacao com o Usuario (o coracao do workflow — NUNCA pular)

Apresentar as claims via AskUserQuestion, **infra PRIMEIRO** (e onde o usuario
mais agrega), depois 1 pergunta por area. Opcoes por claim/grupo:

- **Confere** → marcada `validated`
- **Errado** → usuario corrige; a versao DELE substitui a claim (`validated`)
- **Nao sei** → marcada `unverified`

Corrigido pelo usuario SEMPRE vence o que o modelo inferiu do codigo.

**Smoke por area (alimenta o regression gate — vide `regression-gate.md`):**
junto com a validacao de cada area, perguntar **"como voce confere HOJE que esta
area funciona?"** (1 comando/passo observavel: um curl, uma tela, uma query, um
numero que deve bater). Resposta vira a secao `## Smoke` da doc na FASE 4.
Se o usuario nao souber, o @architect sugere 1 smoke a partir dos entry points
e o usuario confirma. Sem resposta → doc recebe `- (sem smoke registrado ...)`.
Aproveitar para perguntar quais areas sao "coracao" do negocio → preencher
`regression_gate.critical_paths` no `.aivoux/config.yaml`.

---

## FASE 4 — Escrita (via aivoux-scribe, claims validadas no prompt)

Spawnar `aivoux-scribe` para gravar:

1. **`docs/features/{slug}.md`** por area — formato padrao do scribe (<=400
   tokens, linguagem natural, fatos operacionais). Frontmatter ganha
   `discovery_status: validated | partial | unverified`. Incluir a secao
   `## Smoke` com o(s) passo(s) validados na FASE 3 (regression gate).
2. **`docs/features/index.md`** — linha por area no formato padrao + **uma linha
   `infra`** com `kw: infra, vps, ssh, deploy, porta, supabase, servidor` —
   assim o lookup do router injeta a infra em demandas de deploy/infra.
3. **`.aivoux/infra.md`** — fatos de infra validados: host/IP canonico, porta
   SSH, como cada servico roda (cron/systemd/docker/pm2), DB ATIVO (host + ref),
   comando de smoke test. So o que foi `validated`; o resto com marcador `?`.
4. **`docs/tech-debt.md`** — backlog: cada item com **evidencia da ferramenta**
   (nome + output resumido), impacto e acao sugerida. Header obrigatorio:
   "NAO deletar/alterar nada daqui diretamente — abrir demanda via /aivoux/router".
5. **`.aivoux/context-snapshot.md`** — refresh do snapshot (context_scan).

---

## Fechamento (obrigatorio, literal)

```
✓ AIVOUX discover concluido
Areas: {N} mapeadas ({X} validated · {Y} unverified)
Docs: docs/features/index.md + {N} feature docs · infra: .aivoux/infra.md
Tech debt: {N} itens em docs/tech-debt.md (com evidencia; nenhuma limpeza executada)
Proximo: revisar docs/tech-debt.md e abrir demandas via /aivoux/router
```

Se o usuario abortou a validacao no meio: gravar apenas o validado ate ali,
fechar com `Areas: {parcial}` e listar o que ficou pendente.
