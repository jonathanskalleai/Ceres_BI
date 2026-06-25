#!/usr/bin/env bash
# AIVOUX quality-guard — PostToolUse hook (Edit|Write|NotebookEdit)
# Enforcement DETERMINISTICO das 12 best practices estruturais.
# Roda SEMPRE, independente de o agente lembrar das regras — essa e a teeth
# contra monolitos. Le o gate de .aivoux/config.yaml (code_quality.component_hard_gate).
#
# Contrato: exit 2 + mensagem em stderr -> Claude ve o feedback e deve agir.
# Falhas internas sao silenciosas (exit 0) — nunca travar por bug do hook.
#
# Politica de tamanho (evita atrito em arquivos legados grandes):
# - Write (arquivo criado/reescrito): >gate = BLOQUEIA (exit 2). Monolito nasce aqui.
# - Edit/NotebookEdit (patch pontual): >gate = nota leve (exit 0). @reviewer/@qa pegam.
# - `any` injustificado: BLOQUEIA sempre, em qualquer tool.

set +e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
CONFIG_FILE="$PROJECT_DIR/.aivoux/config.yaml"

INPUT=""
[ ! -t 0 ] && INPUT=$(cat 2>/dev/null)
[ -z "$INPUT" ] && exit 0

# --- extrair file_path + tool_name (jq se houver, senao grep) ---
FILE=""
TOOL=""
if command -v jq >/dev/null 2>&1; then
  FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
  TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
fi
if [ -z "$FILE" ]; then
  FILE=$(printf '%s' "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')
fi
if [ -z "$TOOL" ]; then
  TOOL=$(printf '%s' "$INPUT" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"tool_name"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')
fi
[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

# --- so codigo aplicavel ---
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac
# ignorar testes, gerados e vendored
case "$FILE" in
  *.test.*|*.spec.*|*.d.ts|*/node_modules/*|*/dist/*|*/build/*|*/.next/*) exit 0 ;;
esac

# --- gate de tamanho (config -> default 300) ---
GATE=300
if [ -f "$CONFIG_FILE" ]; then
  C=$(grep -E '^[[:space:]]*component_hard_gate:' "$CONFIG_FILE" 2>/dev/null | head -1 | sed -E 's/.*component_hard_gate:[[:space:]]*//; s/[^0-9].*$//')
  [ -n "$C" ] && GATE="$C"
fi

LINES=$(wc -l < "$FILE" 2>/dev/null | tr -d ' ')
[ -z "$LINES" ] && exit 0

# --- any injustificado (heuristica) ---
ANY=$(grep -nE ':[[:space:]]*any\b|as[[:space:]]+any|<any>' "$FILE" 2>/dev/null | grep -vE 'eslint|//.*any|/\*' | wc -l | tr -d ' ')

BLOCK=0          # exit 2 (Claude ve e deve agir)
MSG=""

if [ "$LINES" -gt "$GATE" ]; then
  if [ "$TOOL" = "Write" ]; then
    BLOCK=1
    MSG="⛔ AIVOUX quality-guard: '$FILE' tem $LINES linhas (HARD gate: $GATE).
   Best Practice #4 (Well-Structured Components) violada. Quebre em
   sub-componentes / custom hooks / utils ANTES de prosseguir. NAO entregue
   este arquivo ao @reviewer/@qa neste estado — sera FAIL automatico."
  else
    # Edit/patch pontual em arquivo grande (possivelmente legado): nota leve, nao bloqueia.
    MSG="ℹ AIVOUX quality-guard: '$FILE' tem $LINES linhas (gate $GATE).
   Arquivo grande (Best Practice #4). Se voce esta crescendo este arquivo,
   considere quebrar agora. @reviewer/@qa darao FAIL se permanecer >$GATE."
  fi
fi

if [ "${ANY:-0}" -gt 0 ]; then
  BLOCK=1
  MSG="$MSG
⚠ AIVOUX quality-guard: $ANY uso(s) de 'any' em '$FILE' (Best Practice #3).
   Substitua por tipos especificos ou 'unknown' + narrowing, ou justifique
   com comentario inline. 'any' injustificado em codigo novo = FAIL no @qa."
fi

# Sempre emite a mensagem (se houver) em stderr; exit 2 so quando ha violacao bloqueante.
[ -n "$MSG" ] && printf '%s\n' "$MSG" >&2
[ "$BLOCK" -eq 1 ] && exit 2

exit 0
