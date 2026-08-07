#!/usr/bin/env bash
# AIVOUX statusline — exibe na barra inferior do Claude Code:
#   AIVOUX · MODELO · pipeline-status
# Sem tiers — todos os agentes rodam Opus (scribe em Haiku).
#
# Recebe JSON via stdin (sessionId, model.id, model.display_name, workspace.cwd, etc.)
# Retorna UMA linha de saida (primeira linha vira a status line).

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
INPUT=$(cat 2>/dev/null || echo '{}')

# --- Modelo atual da sessao ---
MODEL_NAME=$(echo "$INPUT" | grep -oE '"display_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"display_name"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/' || true)
if [ -z "$MODEL_NAME" ]; then
  MODEL_ID=$(echo "$INPUT" | grep -oE '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"id"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/' || true)
  MODEL_NAME="${MODEL_ID:-?}"
fi

# Encurtar nome do modelo
case "$MODEL_NAME" in
  *Opus*|*opus*) MODEL_SHORT="Opus" ;;
  *Sonnet*|*sonnet*) MODEL_SHORT="Sonnet" ;;
  *Haiku*|*haiku*) MODEL_SHORT="Haiku" ;;
  *) MODEL_SHORT="$MODEL_NAME" ;;
esac

# --- Pipeline ativo? ---
MARKER="$PROJECT_DIR/.aivoux/.pipeline-active"
PIPE_STATUS="idle"
if [ -f "$MARKER" ]; then
  if [ -z "$(find "$MARKER" -mmin +60 2>/dev/null)" ]; then
    PIPE_STATUS="ACTIVE"
  fi
fi

# --- Output (uma linha) ---
# AIVOUX · Opus · pipeline:idle
echo "AIVOUX · ${MODEL_SHORT} · pipeline:${PIPE_STATUS}"
