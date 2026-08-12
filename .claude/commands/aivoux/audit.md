# AIVOUX — Audit (Revisao Posterior)

Executa @reviewer + @qa + @security em codigo ja aprovado (desenvolvido em TIER FAST).

---

## Quando Usar

- Apos terminar um ciclo de desenvolvimento (TIER FAST)
- Antes de fazer push/release em producao
- Para revisar todo o codigo de uma vez

---

## Uso

```
/aivoux/audit [escopo]
```

**escopo:**
- `all` — todos os arquivos modificados desde o ultimo audit
- `files:path1,path2` — arquivos especificos
- `since:YYYY-MM-DD` — desde a data
- `since:HEAD~N` — ultimos N commits

---

## Pipeline executado

```
reviewer → qa → security (se escopo sensivel)
```

**O que nao executa:**
- @architect, @dev, @pm, etc. (ja fizeram seu trabalho)
- Apenas os gates de qualidade

---

## Output

```
▶ AUDIT · {ESCOPO}
Pipeline: reviewer → qa → security
```

Apos cada agente:

```
▣ @{nome}: {feito em <=80 chars} · Proximo: @{x ou "fim"}
```

Fechamento:

```
✓ AUDIT concluido
Agentes: reviewer → qa → security
Verdict: {PASS | FAIL | CONCERNS}
Pendencias: {lista de issues a corrigir}
```
