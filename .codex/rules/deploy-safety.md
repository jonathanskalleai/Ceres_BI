# AIVOUX — Deploy Safety Gate

Resposta direta ao padrao de falha #1 das sessoes reais: **fixes que sobem
limpos mas quebram producao e perdem dados** (regex com Unicode literal derrubou
o worker; SQL quebrado zerou os dashboards). Um deploy so e "DONE" quando provou,
em runtime, que o servico sobe e processa um caso real — nao quando o `git push`
retornou 0.

Owner: **@devops**. Validator: **@qa** (runtime). Aplica-se a toda publicacao
que altera codigo ou schema em ambiente vivo.

## Escopo por modo

- **DEVELOPMENT:** @devops pode publicar a branch, abrir PR ou criar preview
  nao produtivo. Essa publicacao nao e release de producao: faz as validacoes
  locais proporcionais, registra a demanda em `docs/development/pending/` e nao
  chama @reviewer/@security/@qa.
- **FULL:** o gate abaixo e obrigatorio antes de merge, release ou producao.
- Qualquer operacao produtiva exige `FULL` ou `aivoux-audit pending`, mesmo que
  a demanda tenha sido implementada em DEVELOPMENT.

---

## Regra de Ouro

> `git push` com exit 0 ≠ deploy funcionando.
> Build passou ≠ servico sobe.
> Servico sobe ≠ processa payload real.
>
> **Nenhum deploy e declarado DONE sem boot check + smoke test em runtime.**

---

## Gate Obrigatorio (antes de declarar DONE)

Na ordem. Falhou qualquer um → `Status: BLOCKED`, reportar, NAO declarar sucesso.

1. **Quality gate** (ja existente): lint, typecheck, test, build passam
2. **Boot check** — o servico/worker/function SOBE sem erro:
   - Worker/edge function: invocar e confirmar que inicializa (sem erro de sintaxe,
     regex/Unicode literal, import quebrado, env var faltando)
   - App: processo inicia e responde health check
   - Migration: aplica e o schema cache (ex: PostgREST) e recarregado
3. **Smoke test** — processa pelo menos UM caso real end-to-end:
   - Webhook/API: enviar payload de teste representativo → resposta esperada
   - Cada tipo critico de input (ex: texto, audio, PDF, grupo) se o change os toca
   - DB: rodar a query/funcao alterada com dados reais e conferir o resultado
3.1 **Re-smoke dos vizinhos (Regression Gate F4)** — no ambiente vivo, apos o
   smoke da mudanca: computar o blast radius (`--base <SHA do deploy anterior>`,
   manual no Codex) e re-executar o `## Smoke` de cada feature afetada +
   `regression_gate.critical_paths`. Afetada quebrada pos-deploy = ROLLBACK
   (SHA do gate 5). Detalhes em `regression-gate.md`.
4. **SHA verificado no REMOTO** — confirmar o que foi publicado de fato:
   - `git ls-remote origin <branch>` / `gh` — comparar com o que voce acha que subiu
   - NUNCA reportar SHA do `main` local stale como se fosse o estado do remoto
5. **Rollback pronto** — saber como reverter (SHA anterior, migration down) ANTES de subir
6. **Observability (F5)** — em projeto com usuarios reais
   (`observability.require_tracking_on_deploy: true`):
   - Error tracking configurado (handler global) + **1 evento de teste RECEBIDO**
     no canal (Sentry/GlitchTip/webhook) — "configurei" sem evento recebido nao conta
   - `/health` respondendo no ambiente vivo (quando o projeto tem)
   - Sem error tracking = o proximo erro de producao sera descoberto pelo USUARIO,
     nao por voce. Detalhes em `observability-standards.md` #2/#3.

---

## Anti-padroes (cada um ja causou perda de dados real)

- ❌ Declarar deploy concluido porque `npm run build` passou (servico nem subiu)
- ❌ Editar regex/template e nao validar que o worker ainda parseia (Unicode literal crashou)
- ❌ Alterar funcao SQL/filtro de BI sem rodar com dados reais (zerou todos os charts)
- ❌ Reportar merge SHA lendo `git log` local em vez do remoto
- ❌ Migration sem recarregar schema cache → endpoint quebra so depois, em runtime

---

## Mudancas de alto risco (smoke test NAO e opcional)

- Pipeline de mensagens / webhook em producao (perda silenciosa de dados)
- Funcoes/queries que alimentam dashboards ou relatorios
- Migrations com CHECK constraint / enum novo / index com expressao
- Qualquer parser (regex, template, serializacao) em caminho critico

Para esses, o @qa deve ver o output real do smoke test antes de qualquer PASS,
conforme `QA Runtime Verification`.

---

## Integracao

- Quality Gates de `shared-config.md`: este gate roda DEPOIS dos 4 checks, antes do push final
- Pipeline DEPLOY do router termina com este gate; sem ele → `BLOCKED`
- `@devops` e dono; em deploy, **read-only no codigo** (vide AGENTS.md "Deploy Tasks = Read-Only")
- **Pipeline Integrity (F6):** em `FULL`, o pipeline exige QA PASS (+ reviewer
  PASS) ancorado ao SHA ANTES do push. No Claude Code isso e mecanico
  (`deploy-gate.sh`); no Codex e comportamental — @devops so publica com os
  verdicts presentes (vide `pipeline-integrity.md`). Em `DEVELOPMENT`, a
  excecao fica limitada a branch/PR/preview nao produtivo. F6 impede a
  publicacao produtiva sair sem pipeline; F1 (este gate) valida o que saiu (boot
  + smoke no ambiente vivo).
