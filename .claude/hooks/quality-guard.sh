#!/usr/bin/env bash
# AIVOUX quality-guard — PostToolUse hook (Edit|Write|NotebookEdit)
# Enforcement DETERMINISTICO das best practices estruturais + observability.
# Roda SEMPRE, independente de o agente lembrar das regras — essa e a teeth
# contra monolitos e catches silenciosos.
#
# Config em .aivoux/config.yaml (coding_standards):
#   component_warn_lines (default 300) — aviso, nao bloqueia
#   component_hard_gate  (default 400) — bloqueia Write acima disso
#
# Contrato: exit 2 + mensagem em stderr -> Claude ve o feedback e deve agir.
# Falhas internas sao silenciosas (exit 0) — nunca travar por bug do hook.
#
# Politica de tamanho (evita atrito em arquivos legados grandes):
# - Write >hard_gate: BLOQUEIA (exit 2). Monolito nasce aqui.
# - Write/Edit >warn: nota leve (exit 0). @reviewer/@qa pegam se crescer.
# - `any` injustificado: BLOQUEIA sempre, em qualquer tool.
# - catch silencioso (sem log): nota leve (heuristica — @qa e quem da FAIL).

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

# --- gates de tamanho (config -> defaults 300 warn / 400 hard) ---
WARN=300
GATE=400
if [ -f "$CONFIG_FILE" ]; then
  W=$(grep -E '^[[:space:]]*component_warn_lines:' "$CONFIG_FILE" 2>/dev/null | head -1 | sed -E 's/.*component_warn_lines:[[:space:]]*//; s/[^0-9].*$//')
  [ -n "$W" ] && WARN="$W"
  C=$(grep -E '^[[:space:]]*component_hard_gate:' "$CONFIG_FILE" 2>/dev/null | head -1 | sed -E 's/.*component_hard_gate:[[:space:]]*//; s/[^0-9].*$//')
  [ -n "$C" ] && GATE="$C"
  # retrocompat: config antigo usava max_component_lines como hard gate
  if [ -z "$C" ]; then
    C=$(grep -E '^[[:space:]]*max_component_lines:' "$CONFIG_FILE" 2>/dev/null | head -1 | sed -E 's/.*max_component_lines:[[:space:]]*//; s/[^0-9].*$//')
    [ -n "$C" ] && GATE="$C"
  fi
fi

LINES=$(wc -l < "$FILE" 2>/dev/null | tr -d ' ')
[ -z "$LINES" ] && exit 0

# --- any injustificado (heuristica) ---
ANY=$(grep -nE ':[[:space:]]*any\b|as[[:space:]]+any|<any>' "$FILE" 2>/dev/null | grep -vE 'eslint|//.*any|/\*' | wc -l | tr -d ' ')

# --- catch silencioso (heuristica observability — nunca bloqueia) ---
# catch cujo corpo (ate 6 linhas) nao contem log/report/rethrow/justificativa.
SILENT_CATCH=$(awk '
  /catch[[:space:]]*(\(|\{)/ {
    found=0
    for (i=0; i<=6; i++) {
      if ((getline line) <= 0) break
      if (line ~ /logger|console\.(error|warn|log)|captureException|Sentry|reportError|log\.|throw|rethrow|fallback esperado/) { found=1; break }
      if (line ~ /^[[:space:]]*\}/ && i>0) break
    }
    if (!found) n++
  }
  END { print n+0 }
' "$FILE" 2>/dev/null)

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
    MSG="ℹ AIVOUX quality-guard: '$FILE' tem $LINES linhas (HARD gate $GATE).
   Arquivo acima do gate (Best Practice #4). Se voce esta crescendo este
   arquivo, quebre agora. @reviewer/@qa darao FAIL se permanecer >$GATE."
  fi
elif [ "$LINES" -gt "$WARN" ]; then
  # zona de aviso (warn..gate): nao bloqueia, mas sinaliza a tendencia a monolito.
  MSG="ℹ AIVOUX quality-guard: '$FILE' tem $LINES linhas (aviso: $WARN, HARD gate: $GATE).
   Zona de risco de monolito (Best Practice #4, meta <200 para codigo novo).
   Planeje a quebra em sub-componentes/hooks agora — acima de $GATE vira FAIL."
fi

if [ "${ANY:-0}" -gt 0 ]; then
  BLOCK=1
  MSG="$MSG
⚠ AIVOUX quality-guard: $ANY uso(s) de 'any' em '$FILE' (Best Practice #3).
   Substitua por tipos especificos ou 'unknown' + narrowing, ou justifique
   com comentario inline. 'any' injustificado em codigo novo = FAIL no @qa."
fi

if [ "${SILENT_CATCH:-0}" -gt 0 ]; then
  MSG="$MSG
ℹ AIVOUX quality-guard: $SILENT_CATCH catch(es) possivelmente SILENCIOSO(s) em '$FILE'
   (observability-standards: regra do catch). Catch sem log/report engole o
   root cause — logue o erro antes de tratar, faca rethrow, ou justifique com
   comentario inline. Catch silencioso em codigo novo = FAIL no @qa.
   (Heuristica — se for falso positivo, comentario inline resolve.)"
fi

# Sempre emite a mensagem (se houver) em stderr; exit 2 so quando ha violacao bloqueante.
[ -n "$MSG" ] && printf '%s\n' "$MSG" >&2
[ "$BLOCK" -eq 1 ] && exit 2

exit 0
