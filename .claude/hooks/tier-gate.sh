#!/usr/bin/env bash
# AIVOUX tier-gate — PreToolUse, nao-bloqueante
#
# Marca quando TIER FAST esta ativo para que o deploy-gate.sh possa
# avisar (mas nao bloquear) quando codigo TIER FAST vai pra producao.
#
# Este hook NAO bloqueia nada — apenas registra o tier ativo.
set +e

INPUT=""
[ ! -t 0 ] && INPUT=$(cat 2>/dev/null)
[ -z "$INPUT" ] && INPUT="$CLAUDE_TOOL_INPUT"
[ -z "$INPUT" ] && exit 0

GATES=".aivoux/gates"
mkdir -p "$GATES" 2>/dev/null

# Extrair tier do input
TIER=""
if command -v jq >/dev/null 2>&1; then
  TIER=$(printf '%s' "$INPUT" | jq -r '.tool_input // empty' 2>/dev/null | grep -oE '\*fast|\*full' | head -1)
fi
[ -z "$TIER" ] && TIER=$(printf '%s' "$INPUT" | grep -oE '\*fast|\*full' | head -1)

# Se encontrou tier no comando, marcar
if [ -n "$TIER" ]; then
  if [ "$TIER" = "*fast" ]; then
    touch "$GATES/tier-fast-used"
    printf '📍 AIVOUX: TIER FAST ativado — gates de qualidade desativados.\n'
    printf '   Para revisar antes de producao: /aivoux/audit\n'
  else
    rm -f "$GATES/tier-fast-used"
  fi
fi

exit 0
