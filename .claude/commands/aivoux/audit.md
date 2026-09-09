# AIVOUX — Audit (Revisao Posterior)

Executa os gates do modo FULL sobre codigo/schema que foi desenvolvido no modo
DEVELOPMENT e ficou registrado em `docs/development/pending/`.

---

## Quando Usar

- Apos terminar um ciclo de desenvolvimento (`*dev`, `*development` ou `*fast`)
- Antes de fazer push/release em producao
- Para revisar todo o codigo de uma vez

---

## Uso

```
/aivoux/audit [escopo]
```

**escopo:**
- `pending` — registros `PENDING_REVIEW` ou `NEEDS_FIX` (default recomendado)
- `all` — todos os arquivos modificados desde o ultimo audit
- `files:path1,path2` — arquivos especificos
- `since:YYYY-MM-DD` — desde a data
- `since:HEAD~N` — ultimos N commits

---

## Pipeline executado

```
reviewer → security (se escopo sensivel) → qa
```

Antes do primeiro `Agent`, definir `.aivoux/gates/pipeline-mode` como `full` (ou
ativar `*full`) e mantê-lo assim até o fechamento. Isso faz os hooks tratarem a
auditoria como aprovação/release, mesmo que o projeto tenha `default:
development`. Depois, o usuário pode voltar a `*dev` para novas iterações.

**O que nao executa:**
- @architect, @dev, @pm, etc. (ja fizeram seu trabalho)
- Apenas os gates de qualidade

---

## Output

```
▶ AUDIT · {ESCOPO}
Pipeline: reviewer → security (condicional) → qa
```

Apos cada agente:

```
▣ @{nome}: {feito em <=80 chars} · Proximo: @{x ou "fim"}
```

Fechamento:

```
✓ AUDIT concluido
Agentes: reviewer → security (condicional) → qa
Verdict: {PASS | FAIL | CONCERNS}
Pendencias: {lista de issues a corrigir}
```

Com `pending`, consolidar os arquivos dos registros e executar os gates uma
unica vez; nao repetir `@architect`, `@pm`, `@analyst`, `@data-engineer` ou
`@dev`. Em caso de sucesso, atualizar cada registro com:

```yaml
status: APPROVED
reviewed_at: <ISO-8601 UTC>
reviewed_sha: <SHA validado>
```

Em caso de falha, preservar `status: NEEDS_FIX` e listar o fix concreto. Nao
marcar `APPROVED` por leitura de codigo sem validacao runtime do @qa.
