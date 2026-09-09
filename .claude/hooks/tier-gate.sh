#!/usr/bin/env bash
# AIVOUX pipeline-mode — PreToolUse, nao-bloqueante
#
# Mantem o modo selecionado pelo router em um arquivo compartilhado pelos
# hooks e pelos tres harnesses. O nome tier-gate permanece por compatibilidade
# com instalacoes existentes.
#
# Este hook NAO bloqueia nada — apenas registra o modo ativo.
set +e

INPUT=""
[ ! -t 0 ] && INPUT=$(cat 2>/dev/null)
[ -z "$INPUT" ] && INPUT="$CLAUDE_TOOL_INPUT"
[ -z "$INPUT" ] && exit 0

GATES=".aivoux/gates"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0
mkdir -p "$GATES" 2>/dev/null

# Extrair modo do input
MODE=""
if command -v jq >/dev/null 2>&1; then
  MODE=$(printf '%s' "$INPUT" | jq -r '.tool_input // empty' 2>/dev/null | grep -oE '\*(dev|development|fast|full)' | head -1)
fi
[ -z "$MODE" ] && MODE=$(printf '%s' "$INPUT" | grep -oE '\*(dev|development|fast|full)' | head -1)

# Se encontrou modo no comando, persistir. DEVELOPMENT inclui aliases legados.
case "$MODE" in
  '*dev'|'*development'|'*fast')
    printf 'development\n' > "$GATES/pipeline-mode" 2>/dev/null
    touch "$GATES/tier-fast-used" 2>/dev/null
    printf '📍 AIVOUX: modo DEVELOPMENT ativado — gates de review/seguranca/QA adiados.\n'
    printf '   Pendencias: docs/development/pending/ · Auditoria: /aivoux/audit pending\n'
    ;;
  '*full')
    printf 'full\n' > "$GATES/pipeline-mode" 2>/dev/null
    rm -f "$GATES/tier-fast-used" 2>/dev/null
    printf '📍 AIVOUX: modo FULL ativado — reviewer/security condicional/QA exigidos.\n'
    ;;
esac

# Inicializar o estado quando o input nao trouxe prefixo explicito.
if [ ! -f "$GATES/pipeline-mode" ]; then
  DEFAULT=""
  if [ -f .aivoux/config.yaml ]; then
    DEFAULT=$(awk '/^pipeline_mode:/{f=1;next} f && /^[^[:space:]]/{exit} f && /^[[:space:]]*default:/{print $2; exit}' .aivoux/config.yaml 2>/dev/null)
  fi
  case "$DEFAULT" in
    development|full) printf '%s\n' "$DEFAULT" > "$GATES/pipeline-mode" 2>/dev/null ;;
    *) printf 'development\n' > "$GATES/pipeline-mode" 2>/dev/null ;;
  esac
fi

exit 0
