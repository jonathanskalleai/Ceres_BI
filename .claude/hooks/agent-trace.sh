#!/usr/bin/env bash
# AIVOUX agent-trace — PostToolUse (Task|Agent)
#
# Registro DETERMINISTICO de cada subagent spawnado na sessao. E a fonte de
# verdade que os gates mecanicos (deploy-gate.sh, scribe-gate.sh) usam para
# saber se @qa / @scribe RODARAM DE FATO — nao se o orquestrador "disse" que
# rodaram. Resposta direta ao incidente F6: subagente falhou com 529 e o
# orquestrador assumiu o papel inline sem avisar (INLINE_DEGRADED invisivel).
#
# Formato do log (.aivoux/gates/agents-run.log):
#   <epoch> <subagent_type>
#
# Nunca bloqueia nada (exit 0 sempre). Falha interna => exit 0.
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
[ -z "$SUB" ] && exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
GATES="$PROJECT_DIR/.aivoux/gates"
mkdir -p "$GATES" 2>/dev/null || exit 0

printf '%s %s\n' "$(date +%s)" "$SUB" >> "$GATES/agents-run.log" 2>/dev/null

exit 0
