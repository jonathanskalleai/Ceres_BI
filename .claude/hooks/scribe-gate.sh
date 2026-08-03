#!/usr/bin/env bash
# AIVOUX scribe-gate — Stop hook, BLOQUEIA o fechamento 1x
#
# Trigger MECANICO da Regra 7 (pipeline-integrity F6): apos @qa PASS, o
# @scribe DEVE rodar (PASSO 4.5) — sem depender do orquestrador lembrar.
# Resposta direta ao incidente real: @scribe nunca foi spawnado, a doc de
# mensageria nao registrou o envio duravel, e a sessao seguinte comecou cega.
#
# Logica:
#   - Existe qa-verdict.json com PASS, fresco (<2h)?
#   - Houve spawn de aivoux-scribe DEPOIS do verdict (agents-run.log)? -> ok
#   - Existe .aivoux/gates/docs-na mais novo que o verdict? -> ok
#     (escape hatch para SIMPLE sem doc relacionada — registrar o motivo dentro)
#   - Senao: exit 2 => bloqueia o stop UMA vez com a instrucao do PASSO 4.5.
#     Na segunda tentativa (stop_hook_active) libera — evita loop infinito.
#
# Falha interna => exit 0 (nunca travar o usuario por bug do hook).
set +e

INPUT=""
[ ! -t 0 ] && INPUT=$(cat 2>/dev/null)

# Anti-loop: se ja bloqueamos uma vez neste stop, liberar.
printf '%s' "$INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
GATES="$PROJECT_DIR/.aivoux/gates"
VFILE="$GATES/qa-verdict.json"

[ ! -f "$VFILE" ] && exit 0

# Verdict velho (>2h) = ciclo anterior; nao cobrar scribe de novo.
[ -n "$(find "$VFILE" -mmin +120 2>/dev/null)" ] && exit 0

VERDICT=""
if command -v jq >/dev/null 2>&1; then
  VERDICT=$(jq -r '.verdict // empty' "$VFILE" 2>/dev/null)
fi
[ -z "$VERDICT" ] && VERDICT=$(grep -oE '"verdict"[[:space:]]*:[[:space:]]*"[^"]*"' "$VFILE" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')
[ "$VERDICT" != "PASS" ] && exit 0

mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null; }
VTS=$(mtime "$VFILE")
[ -z "$VTS" ] && exit 0

# @scribe rodou depois do verdict? (evidencia deterministica de spawn)
LOG="$GATES/agents-run.log"
if [ -f "$LOG" ]; then
  SCRIBE=$(awk -v t="$VTS" '$2 == "aivoux-scribe" && $1 >= t' "$LOG" 2>/dev/null | tail -1)
  [ -n "$SCRIBE" ] && exit 0
fi

# Escape hatch: SIMPLE sem doc relacionada (docs-na com motivo, mais novo que o verdict)
NA="$GATES/docs-na"
if [ -f "$NA" ]; then
  NTS=$(mtime "$NA")
  [ -n "$NTS" ] && [ "$NTS" -ge "$VTS" ] && exit 0
fi

{
  printf '⛔ AIVOUX scribe-gate: @qa emitiu PASS mas o @scribe NAO rodou (PASSO 4.5).\n\n'
  printf 'Documentacao e a memoria do projeto — sem ela a proxima sessao comeca\n'
  printf 'cega e o regression gate fica sem secao ## Smoke. Antes de fechar:\n\n'
  printf '  1. Spawnar Agent(subagent_type="aivoux-scribe") com o contexto\n'
  printf '     consolidado (arquivos tocados, decisoes, smoke executado pelo @qa)\n'
  printf '     para atualizar docs/features/{slug}.md + index.md; OU\n'
  printf '  2. Se for SIMPLE sem doc relacionada (unico caso isento): criar\n'
  printf '     .aivoux/gates/docs-na com 1 linha explicando o motivo; OU\n'
  printf '  3. Se o spawn falhar (529/erro): reportar DOCS_PENDING ao usuario\n'
  printf '     explicitamente no fechamento — nunca engolir silenciosamente.\n'
} >&2
exit 2
