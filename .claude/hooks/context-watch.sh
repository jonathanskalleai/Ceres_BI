#!/bin/bash
# AIVOUX Context Watch
# 1. Setup check: avisa na primeira sessao se configuracoes nao estao aplicadas
# 2. Context watch: avisa quando sessao esta longa, sugere /clear
# Roda em UserPromptSubmit — nunca bloqueia, nunca falha ruidosamente.
set +e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
CONFIG_FILE="$PROJECT_DIR/.aivoux/config.yaml"
STATE_FILE="$PROJECT_DIR/.aivoux/telemetry/session-state.json"
SETUP_FLAG="$PROJECT_DIR/.aivoux/telemetry/setup-verified.flag"
SETTINGS_FILE="$PROJECT_DIR/.claude/settings.json"

mkdir -p "$PROJECT_DIR/.aivoux/telemetry" 2>/dev/null || exit 0

# ── SETUP CHECK (uma vez por instalacao) ─────────────────────────────────────
# Verifica se settings.json tem as permissoes AIVOUX. Roda apenas uma vez
# (flag file previne repeticao). Cria o flag mesmo se settings ok.
if [ ! -f "$SETUP_FLAG" ]; then
  touch "$SETUP_FLAG" 2>/dev/null
  NEEDS_SETUP=0

  if [ ! -f "$SETTINGS_FILE" ]; then
    NEEDS_SETUP=1
  else
    # Checar se Read(**/**) esta no allow (indicador de setup completo)
    if ! grep -q 'Read(\*\*' "$SETTINGS_FILE" 2>/dev/null; then
      NEEDS_SETUP=1
    fi
  fi

  if [ "$NEEDS_SETUP" -eq 1 ]; then
    printf '[AIVOUX-SETUP-REQUIRED]\n'
    printf 'Apresente este aviso ao usuario IMEDIATAMENTE, antes de qualquer outra coisa:\n'
    printf '"⚙ AIVOUX: Configuracoes nao aplicadas neste projeto.\n'
    printf 'Execute: npx @jonathanskalleai/aivoux update\n'
    printf 'Isso aplica permissoes, hooks e regras necessarias para o framework funcionar corretamente."\n'
    exit 0
  fi
fi

# ── CONTEXT WATCH ─────────────────────────────────────────────────────────────
# Ler threshold do config.yaml (default: 20)
WARN_AT=20
if [ -f "$CONFIG_FILE" ]; then
  VAL=$(grep 'warn_at:' "$CONFIG_FILE" 2>/dev/null | head -1 | grep -o '[0-9]*')
  [ -n "$VAL" ] && WARN_AT="$VAL"
fi

RESET_AFTER=3600  # reset apos 1h de inatividade (nova sessao)
NOW=$(date +%s)

# Ler estado atual
TURNS=0
LAST_TS=0
if [ -f "$STATE_FILE" ]; then
  if command -v jq >/dev/null 2>&1; then
    TURNS=$(jq -r '.turns // 0' "$STATE_FILE" 2>/dev/null)
    LAST_TS=$(jq -r '.last_ts // 0' "$STATE_FILE" 2>/dev/null)
  else
    TURNS=$(grep -o '"turns":[0-9]*' "$STATE_FILE" 2>/dev/null | grep -o '[0-9]*$')
    LAST_TS=$(grep -o '"last_ts":[0-9]*' "$STATE_FILE" 2>/dev/null | grep -o '[0-9]*$')
    TURNS=${TURNS:-0}
    LAST_TS=${LAST_TS:-0}
  fi
fi

# Reset automatico por inatividade (nova sessao detectada)
if [ "$LAST_TS" -gt 0 ]; then
  ELAPSED=$((NOW - LAST_TS))
  if [ "$ELAPSED" -gt "$RESET_AFTER" ]; then
    TURNS=0
  fi
fi

# Incrementar e salvar
TURNS=$((TURNS + 1))
printf '{"turns":%d,"last_ts":%d}\n' "$TURNS" "$NOW" > "$STATE_FILE" 2>/dev/null

# Avisar: no threshold exato, depois a cada 10 turnos
ABOVE=$((TURNS - WARN_AT))
SHOULD_WARN=0
if [ "$TURNS" -eq "$WARN_AT" ]; then
  SHOULD_WARN=1
elif [ "$TURNS" -gt "$WARN_AT" ] && [ $((ABOVE % 10)) -eq 0 ]; then
  SHOULD_WARN=1
fi

if [ "$SHOULD_WARN" -eq 1 ]; then
  printf '[AIVOUX-CONTEXT-WATCH turns=%d]\n' "$TURNS"
  printf 'Apresente este aviso ao usuario antes de processar a demanda:\n'
  printf '"⚠ Sessao com %d turnos — contexto longo pode aumentar custo e reduzir foco.\n' "$TURNS"
  printf 'Se esta e uma nova demanda nao relacionada a conversa atual, considere\n'
  printf 'dar /clear primeiro. Sua demanda sera processada normalmente se continuar."\n'
fi

exit 0
