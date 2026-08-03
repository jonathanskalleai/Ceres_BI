#!/usr/bin/env bash
# AIVOUX docs-lookup-trace — PostToolUse (Read|Bash)
#
# Registra deterministicamente que o Feature-Docs Lookup do PASSO 1 ACONTECEU:
# quando qualquer Read/Bash toca docs/features/index.md, grava o marker
# .aivoux/gates/docs-lookup (epoch). E este marker que o docs-gate.sh checa
# antes de liberar o primeiro spawn de subagent aivoux-*.
#
# Nunca bloqueia nada (exit 0 sempre). Falha interna => exit 0.
set +e

INPUT=""
[ ! -t 0 ] && INPUT=$(cat 2>/dev/null)
[ -z "$INPUT" ] && INPUT="$CLAUDE_TOOL_INPUT"
[ -z "$INPUT" ] && exit 0

# Extrair so o tool_input (file_path/command) quando possivel — evita casar
# com mencoes ao index dentro do CONTEUDO retornado por um Read qualquer.
TARGET=""
if command -v jq >/dev/null 2>&1; then
  TARGET=$(printf '%s' "$INPUT" | jq -r '(.tool_input.file_path // "") + " " + (.tool_input.command // "")' 2>/dev/null)
fi
[ -z "${TARGET// /}" ] && TARGET="$INPUT"

printf '%s' "$TARGET" | grep -q 'docs/features/index\.md' || exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
GATES="$PROJECT_DIR/.aivoux/gates"
mkdir -p "$GATES" 2>/dev/null || exit 0
date +%s > "$GATES/docs-lookup" 2>/dev/null

exit 0
