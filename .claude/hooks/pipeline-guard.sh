#!/usr/bin/env bash
# AIVOUX pipeline-guard — alerta o router contra Edit/Write/NotebookEdit/Bash mutavel
# enquanto um pipeline AIVOUX esta ativo. Subagents AIVOUX devem ignorar (esperado).
#
# Acionado em PreToolUse. NAO bloqueia (exit 0 sempre) — apenas imprime warning.
# Se o Claude que esta sendo guiado e o ROUTER (sessao pai), o warning aparece
# como contexto e ele se corrige (volta ao protocolo do router.md).
#
# TTL do marker: 1h. Apos isso, marker e considerado stale e removido.

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
MARKER="$PROJECT_DIR/.aivoux/.pipeline-active"

# Sem pipeline ativo → nada a fazer
if [ ! -f "$MARKER" ]; then
  exit 0
fi

# TTL: marker > 60 min e considerado stale
if [ -n "$(find "$MARKER" -mmin +60 2>/dev/null)" ]; then
  rm -f "$MARKER" 2>/dev/null || true
  exit 0
fi

TOOL="${CLAUDE_TOOL_NAME:-}"
INPUT="${CLAUDE_TOOL_INPUT:-}"

print_warning() {
  echo "" >&2
  echo "⚠ AIVOUX pipeline-guard — pipeline ativo detectado." >&2
  echo "  Tool tentada: $TOOL" >&2
  echo "  Regra: Edit/Write/NotebookEdit/Bash mutavel devem rodar dentro de" >&2
  echo "         subagent AIVOUX (aivoux-*) via Agent tool." >&2
  echo "" >&2
  echo "  Se voce e o ROUTER (sessao pai): PARE e use" >&2
  echo "    Agent(subagent_type=\"aivoux-{nome}\", prompt=\"...\")" >&2
  echo "  Se voce e um SUBAGENT (aivoux-*): pode ignorar este aviso." >&2
  echo "" >&2
}

case "$TOOL" in
  Edit|NotebookEdit)
    print_warning
    ;;
  Write)
    # Write em paths internos do AIVOUX e permitido pro router (marker, handoffs, telemetry)
    if echo "$INPUT" | grep -qE '\.aivoux/(\.pipeline-active|handoffs/|telemetry/)'; then
      exit 0
    fi
    print_warning
    ;;
  Bash)
    # Bash mutavel (git, npm, deploy, etc.)
    if echo "$INPUT" | grep -qE '(git[[:space:]]+(add|commit|push|reset|merge|rebase|checkout|tag|cherry-pick)|npm[[:space:]]+(install|publish|i[[:space:]]|run[[:space:]]+(dev|build|start|deploy))|pnpm[[:space:]]+(install|i|publish|run)|yarn[[:space:]]+(install|publish|run)|gh[[:space:]]+(pr|release|repo)|terraform|kubectl|docker[[:space:]]+(run|build|push|compose))'; then
      print_warning
    fi
    ;;
esac

exit 0
