#!/usr/bin/env bash
# AIVOUX statusline — exibe na barra inferior do Claude Code:
#   AIVOUX · MODELO · T:N · CTX:XX% · pipeline-status
# Sem tiers — todos os agentes rodam Opus (scribe em Haiku).
#
# Recebe JSON via stdin com context_window.used_percentage,
# context_window.context_window_size, model.display_name, etc.
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
  *Fable*|*fable*) MODEL_SHORT="Fable" ;;
  *) MODEL_SHORT="$MODEL_NAME" ;;
esac

# --- Turnos (de session-state.json) ---
STATE_FILE="$PROJECT_DIR/.aivoux/telemetry/session-state.json"
TURNS=0
if [ -f "$STATE_FILE" ]; then
  TURNS=$(grep -o '"turns":[0-9]*' "$STATE_FILE" 2>/dev/null | grep -o '[0-9]*$' || true)
  TURNS=${TURNS:-0}
fi

# --- Context window (porcentagem de uso) ---
# Claude Code fornece context_window.used_percentage (inteiro 0-100)
# e context_window.context_window_size no JSON via stdin.
CTX_PCT=$(echo "$INPUT" | grep -oE '"used_percentage"[[:space:]]*:[[:space:]]*[0-9]+' | head -1 | grep -o '[0-9]*$' || true)

CTX_DISPLAY=""
if [ -n "$CTX_PCT" ]; then
  CTX_DISPLAY=" · CTX:${CTX_PCT}%"
fi

# --- Pipeline ativo? ---
MARKER="$PROJECT_DIR/.aivoux/.pipeline-active"
PIPE_STATUS="idle"
if [ -f "$MARKER" ]; then
  if [ -z "$(find "$MARKER" -mmin +60 2>/dev/null)" ]; then
    PIPE_STATUS="ACTIVE"
  fi
fi

# --- Output (uma linha) ---
# AIVOUX · Opus · T:5 · CTX:12% · pipeline:idle
echo "AIVOUX · ${MODEL_SHORT} · T:${TURNS}${CTX_DISPLAY} · pipeline:${PIPE_STATUS}"
