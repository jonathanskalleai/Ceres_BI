#!/usr/bin/env bash
# AIVOUX review-gate — PreToolUse (Task|Agent), BLOQUEANTE
#
# Enforcement mecanico: @reviewer e OBRIGATORIO em TODO pipeline que produziu
# codigo — inclusive SIMPLE. Decisao de produto (2026-07): o @reviewer pega
# defeito estrutural real com frequencia; a economia de pular ele em demanda
# "simples" custa mais caro que o spawn. Complexidade NUNCA remove gate de
# qualidade — ela so muda a composicao do planejamento (pm/discussion).
#
# Regra: spawn de `aivoux-qa` e BLOQUEADO se o ultimo spawn de agente que
# produz codigo (aivoux-dev / aivoux-data-engineer) e mais recente que o
# ultimo spawn de aivoux-reviewer (fonte: agents-run.log, escrito pelo hook
# agent-trace.sh — deterministico, nao depende de memoria do orquestrador).
#
# Override: .aivoux/gates/skip-review-authorized — SO com autorizacao explicita
# do usuario nesta conversa. Uso unico, logado em overrides.log. Ao consumir,
# grava reviewer-verdict.json com WAIVED (para o deploy-gate nao re-bloquear).
#
# Contrato: exit 2 + stderr => Claude ve o feedback, spawna aivoux-reviewer
# primeiro e re-spawna o qa. Falha interna => exit 0 (nunca travar por bug).
set +e

INPUT=""
[ ! -t 0 ] && INPUT=$(cat 2>/dev/null)
[ -z "$INPUT" ] && INPUT="$CLAUDE_TOOL_INPUT"
[ -z "$INPUT" ] && exit 0

SUB=""
if command -v jq >/dev/null 2>&1; then
  SUB=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // empty' 2>/dev/null)
fi
[ -z "$SUB" ] && SUB=$(printf '%s' "$INPUT" \
  | grep -oE '"subagent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
  | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')

# So interessa o spawn do @qa.
[ "$SUB" = "aivoux-qa" ] || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0
GATES=".aivoux/gates"
LOG="$GATES/agents-run.log"

# Sem log => agent-trace desabilitado ou nenhum subagent rodou; nao ha como
# cobrar com evidencia. Nao bloquear.
[ -f "$LOG" ] || exit 0

NOW=$(date +%s 2>/dev/null) ; [ -z "$NOW" ] && exit 0
# Janela de 24h: entradas mais velhas sao de outra sessao/ciclo.
CUTOFF=$((NOW - 86400))

LAST_CODE=$(awk -v c="$CUTOFF" '($2=="aivoux-dev" || $2=="aivoux-data-engineer") && $1>=c {t=$1} END{print t}' "$LOG" 2>/dev/null)
[ -z "$LAST_CODE" ] && exit 0   # pipeline nao produziu codigo nesta janela

LAST_REV=$(awk -v c="$CUTOFF" '$2=="aivoux-reviewer" && $1>=c {t=$1} END{print t}' "$LOG" 2>/dev/null)
if [ -n "$LAST_REV" ] && [ "$LAST_REV" -ge "$LAST_CODE" ] 2>/dev/null; then
  exit 0   # reviewer rodou DEPOIS do ultimo agente de codigo — ordem correta
fi

# ===== Override autorizado pelo usuario (uso unico, auditado) =====
OVR="$GATES/skip-review-authorized"
if [ -f "$OVR" ]; then
  mkdir -p "$GATES" 2>/dev/null
  {
    printf '%s OVERRIDE review-gate (spawn aivoux-qa sem aivoux-reviewer)\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    sed 's/^/  autorizacao: /' "$OVR" 2>/dev/null
  } >> "$GATES/overrides.log" 2>/dev/null
  rm -f "$OVR" 2>/dev/null
  # Grava WAIVED ancorado ao HEAD para o deploy-gate reconhecer o override.
  HEAD_SHA=$(git rev-parse HEAD 2>/dev/null)
  if [ -n "$HEAD_SHA" ]; then
    printf '{\n  "sha": "%s",\n  "verdict": "WAIVED",\n  "agent": "user-override",\n  "timestamp": "%s",\n  "scope": "review waived por autorizacao explicita do usuario (skip-review-authorized)"\n}\n' \
      "$HEAD_SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$GATES/reviewer-verdict.json" 2>/dev/null
  fi
  printf '⚠ AIVOUX review-gate: override autorizado consumido (uso unico, logado em %s/overrides.log).\n' "$GATES" >&2
  exit 0
fi

{
  printf '⛔ AIVOUX review-gate: spawn de aivoux-qa BLOQUEADO — @reviewer nao rodou apos o codigo.\n\n'
  printf 'O pipeline produziu codigo (aivoux-dev/aivoux-data-engineer no agents-run.log)\n'
  printf 'e NAO ha spawn de aivoux-reviewer depois disso. @reviewer e OBRIGATORIO em\n'
  printf 'TODO pipeline que toca codigo — inclusive SIMPLE. Complexidade nao remove gate.\n\n'
  printf 'Antes de re-spawnar o @qa:\n'
  printf '  1. Spawnar aivoux-reviewer com o diff/escopo da mudanca.\n'
  printf '  2. Se FAIL estrutural: devolver ao @dev, corrigir, re-spawnar reviewer.\n'
  printf '  3. Reviewer PASS grava .aivoux/gates/reviewer-verdict.json (sha atual) —\n'
  printf '     o deploy-gate exige esse arquivo no push. So entao spawnar aivoux-qa.\n\n'
  printf 'Excecao unica: usuario autorizou EXPLICITAMENTE pular o review nesta conversa\n'
  printf '=> criar .aivoux/gates/skip-review-authorized com a citacao literal (uso unico,\n'
  printf 'auditado). Criar sem autorizacao = fraude de gate (pipeline-integrity.md).\n'
} >&2
exit 2
