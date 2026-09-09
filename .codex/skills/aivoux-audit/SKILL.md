---
name: aivoux-audit
description: AIVOUX Codex — revisao posterior de pendencias do modo development com reviewer, security condicional e QA.
---

# AIVOUX — Audit posterior para Codex

Use o modelo atual da sessao Codex. Nao tente trocar modelo.

Use esta skill para revisar codigo/schema registrado pelo modo `development`.
Ela nao repete planejamento nem implementacao: consolida os registros de
`docs/development/pending/` e executa os gates do modo `full`.

## Uso

```text
/aivoux-audit pending
/aivoux-audit files:src/a.ts,src/b.ts
/aivoux-audit since:HEAD~3
```

Se o escopo for omitido, use `pending`.

## Pipeline

```text
@reviewer -> @security (se o diff for sensivel) -> @qa
```

Antes de iniciar a primeira etapa, escreva `full` em `.aivoux/gates/pipeline-mode`
ou ative `*full`, e mantenha esse modo durante toda a auditoria. Assim os
contratos de merge/release/producao continuam ativos mesmo quando o default do
projeto e `development`.

Leia as skills/personas correspondentes antes de cada etapa. O @reviewer grava
`reviewer-verdict.json`, o @security grava `security-verdict.json` quando
aplicavel e o @qa exige validacao runtime antes de emitir PASS. Se qualquer gate
falhar, nao invente um PASS e nao corrija codigo automaticamente: deixe os
registros em `NEEDS_FIX` e devolva o fix para uma nova demanda `*dev` ou `*full`.

## Registro

Com sucesso, atualizar cada registro auditado com:

```yaml
status: APPROVED
reviewed_at: <ISO-8601 UTC>
reviewed_sha: <SHA validado>
```

Com falha, usar `status: NEEDS_FIX` e registrar apenas o problema acionavel.
Nunca copiar prompts completos, segredos ou payloads sensiveis para os registros.

## Fechamento

```text
✓ AIVOUX audit concluido
Escopo: {pending|all|files|since}
Pipeline: reviewer -> security (condicional) -> qa
Verdict: {PASS|FAIL|CONCERNS}
Pendencias: {lista curta ou -}
```
