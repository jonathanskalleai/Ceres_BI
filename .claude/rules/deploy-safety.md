# AIVOUX — Deploy Safety Gate

Resposta direta ao padrao de falha #1 das sessoes reais: **fixes que sobem
limpos mas quebram producao e perdem dados** (regex com Unicode literal derrubou
o worker; SQL quebrado zerou os dashboards). Um deploy so e "DONE" quando provou,
em runtime, que o servico sobe e processa um caso real — nao quando o `git push`
retornou 0.

Owner: **@devops**. Validator: **@qa** (runtime). Aplica-se a TODO deploy/release/push
que altera codigo ou schema em ambiente vivo.

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
4. **SHA verificado no REMOTO** — confirmar o que foi publicado de fato:
   - `git ls-remote origin <branch>` / `gh` — comparar com o que voce acha que subiu
   - NUNCA reportar SHA do `main` local stale como se fosse o estado do remoto
5. **Rollback pronto** — saber como reverter (SHA anterior, migration down) ANTES de subir

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
- `@devops` e dono; em deploy, **read-only no codigo** (vide CLAUDE.md "Deploy Tasks = Read-Only")
