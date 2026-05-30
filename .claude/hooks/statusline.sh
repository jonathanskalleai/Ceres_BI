#!/usr/bin/env bash
# AIVOUX statusline — exibe na barra inferior do Claude Code:
#   AIVOUX · TIER · MODELO · pipeline-status
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

# --- Tier ativo (session-tier override > config.yaml > default premium) ---
TIER="premium"
TIER_SOURCE="default"

SESSION_TIER_FILE="$PROJECT_DIR/.aivoux/.session-tier"
CONFIG_FILE="$PROJECT_DIR/.aivoux/config.yaml"

if [ -f "$SESSION_TIER_FILE" ]; then
  # Verificar TTL 4h
  if [ -z "$(find "$SESSION_TIER_FILE" -mmin +240 2>/dev/null)" ]; then
    SESSION_TIER=$(grep -E '^tier:' "$SESSION_TIER_FILE" 2>/dev/null | head -1 | sed -E 's/^tier:[[:space:]]*//' | tr -d ' \r\n')
    if [ -n "$SESSION_TIER" ]; then
      TIER="$SESSION_TIER"
      TIER_SOURCE="session"
    fi
  fi
fi

if [ "$TIER_SOURCE" = "default" ] && [ -f "$CONFIG_FILE" ]; then
  CONFIG_TIER=$(grep -E '^model_tier:' "$CONFIG_FILE" 2>/dev/null | head -1 | sed -E 's/^model_tier:[[:space:]]*//' | sed -E 's/[[:space:]]*#.*$//' | tr -d ' \r\n"')
  if [ -n "$CONFIG_TIER" ]; then
    TIER="$CONFIG_TIER"
    TIER_SOURCE="config"
  fi
fi

TIER_UP=$(echo "$TIER" | tr '[:lower:]' '[:upper:]')

# --- Pipeline ativo? ---
MARKER="$PROJECT_DIR/.aivoux/.pipeline-active"
PIPE_STATUS="idle"
if [ -f "$MARKER" ]; then
  if [ -z "$(find "$MARKER" -mmin +60 2>/dev/null)" ]; then
    PIPE_STATUS="ACTIVE"
  fi
fi

# --- Output (uma linha) ---
# AIVOUX · PREMIUM · Opus · pipeline:idle
echo "AIVOUX · ${TIER_UP} · ${MODEL_SHORT} · pipeline:${PIPE_STATUS}"
