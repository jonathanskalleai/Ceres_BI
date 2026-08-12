#!/usr/bin/env bash
# AIVOUX deploy-gate — PreToolUse (Bash + MCP deploy tools), BLOQUEANTE
#
# Hard gate mecanico do pipeline (F6): nenhum push/PR/deploy sai sem QA PASS
# registrado PARA O SHA ATUAL, com evidencia de que o @qa RODOU DE FATO como
# subagent. Resposta direta ao incidente real: Fase 2 foi do codigo direto
# pro deploy sem @reviewer/@qa/@scribe, e o bug (retry de midia sem base64)
# so foi descoberto em producao.
#
# Contrato (igual delete-guard): exit 2 + stderr => Claude ve o feedback e
# NAO executa. Falha interna do hook => exit 0 (nunca travar por bug do hook).
#
# O que valida, na ordem:
#   0. Override autorizado pelo usuario (.aivoux/gates/skip-pipeline-authorized)
#      — consumido no uso e logado. So pode ser criado com autorizacao EXPLICITA
#      do usuario no prompt (vide pipeline-integrity.md).
#   1. Range docs-only e isento (typo/docs nao exigem pipeline).
#   2. .aivoux/gates/qa-verdict.json existe, verdict PASS|WAIVED, sha do
#      verdict == HEAD (ou commits pos-verdict sao docs-only — ex: @scribe).
#   3. agents-run.log comprova spawn real de aivoux-qa apos o commit validado
#      — verdict "inline" escrito sem spawnar @qa NAO vale (INLINE_DEGRADED).
#   4. critical_paths (config.yaml) tem secao '## Smoke' em docs/features/
#      — sem smoke o regression gate e teatro (roda mas nunca falha).
set +e

INPUT=""
[ ! -t 0 ] && INPUT=$(cat 2>/dev/null)
[ -z "$INPUT" ] && INPUT="$CLAUDE_TOOL_INPUT"
[ -z "$INPUT" ] && exit 0

TOOL="" ; CMD=""
if command -v jq >/dev/null 2>&1; then
  TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
  CMD=$(printf '%s'  "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
fi
[ -z "$TOOL" ] && TOOL=$(printf '%s' "$INPUT" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')
[ -z "$CMD" ] && CMD=$(printf '%s' "$INPUT" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*' | head -1 | sed -E 's/.*:[[:space:]]*"//')

CMDPOS='(^|[;&|(])[[:space:]]*'
IS_DEPLOY=0

case "$TOOL" in
  mcp__supabase__deploy_edge_function|mcp__supabase__apply_migration)
    IS_DEPLOY=1
    ;;
  Bash|"")
    [ -z "$CMD" ] && CMD="$INPUT"
    if printf '%s' "$CMD" | grep -qE "${CMDPOS}(git[[:space:]]+push|gh[[:space:]]+pr[[:space:]]+(create|merge)|gh[[:space:]]+release[[:space:]]+create|vercel([[:space:]]+deploy|[[:space:]]+--prod|[[:space:]]*$)|netlify[[:space:]]+deploy|fly[[:space:]]+deploy|flyctl[[:space:]]+deploy|wrangler[[:space:]]+(deploy|publish)|railway[[:space:]]+up|supabase[[:space:]]+functions[[:space:]]+deploy|docker[[:space:]]+push|kubectl[[:space:]]+apply)"; then
      IS_DEPLOY=1
    fi
    ;;
esac
[ "$IS_DEPLOY" = "0" ] && exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0
GATES=".aivoux/gates"
CONFIG=".aivoux/config.yaml"
VFILE="$GATES/qa-verdict.json"
LOG="$GATES/agents-run.log"

# Fora de repo git => nao ha como ancorar verdict a SHA; nao bloquear.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

block() {
  {
    printf '⛔ AIVOUX deploy-gate: push/deploy BLOQUEADO (pipeline-integrity F6).\n'
    printf '   Motivo: %s\n\n' "$1"
    printf 'Regra: NENHUM push/PR/deploy sem QA PASS registrado para o SHA atual.\n'
    printf 'yolo_mode NAO significa pular etapas. Falha de subagente (529) NAO e\n'
    printf 'desculpa — retry, ou pare e pergunte ao usuario. Verdict inline sem\n'
    printf 'spawn real de aivoux-qa e INLINE_DEGRADED e NAO passa neste gate.\n\n'
    printf 'Como desbloquear (em ordem de preferencia):\n'
    printf '  1. Rodar o pipeline: @dev -> @reviewer -> @qa (subagent aivoux-qa\n'
    printf '     grava .aivoux/gates/qa-verdict.json com o SHA validado).\n'
    printf '  2. Se o usuario AUTORIZOU EXPLICITAMENTE pular o pipeline nesta\n'
    printf '     demanda: criar .aivoux/gates/skip-pipeline-authorized contendo a\n'
    printf '     citacao literal da autorizacao. O override e de USO UNICO e fica\n'
    printf '     registrado em .aivoux/gates/overrides.log. NAO crie este arquivo\n'
    printf '     sem o usuario ter autorizado nesta conversa.\n'
  } >&2
  exit 2
}

# ===== 0) Override autorizado pelo usuario (uso unico, auditado) =====
OVR="$GATES/skip-pipeline-authorized"
if [ -f "$OVR" ]; then
  mkdir -p "$GATES" 2>/dev/null
  {
    printf '%s OVERRIDE tool=%s cmd=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$TOOL" "$(printf '%s' "$CMD" | head -c 200)"
    sed 's/^/  autorizacao: /' "$OVR" 2>/dev/null
  } >> "$GATES/overrides.log" 2>/dev/null
  rm -f "$OVR" 2>/dev/null
  printf '⚠ AIVOUX deploy-gate: override autorizado consumido (uso unico, logado em %s/overrides.log).\n' "$GATES" >&2
  exit 0
fi

HEAD_SHA=$(git rev-parse HEAD 2>/dev/null)
[ -z "$HEAD_SHA" ] && exit 0

DOCS_ONLY_RE='^(docs/|\.aivoux/|\.claude/|.*\.(md|txt)$)'

# ===== 1) TIER FAST: permitir deploy sem QA verdict, mas avisar =====
TIER_FAST_MARKER="$GATES/tier-fast-used"
if [ ! -f "$VFILE" ] && [ -f "$TIER_FAST_MARKER" ]; then
  {
    printf '⚠ AIVOUX deploy-gate: TIER FAST detectado — deploy permitido mas RECOMENDADO rodar @reviewer + @qa antes de producao.\n'
    printf '   Codigo feito em TIER FAST nao passou por gates de qualidade.\n'
    printf '   Para revisar tudo de uma vez: /aivoux/audit\n'
  } >&2
  exit 0
fi

# ===== 2) git push: range docs-only e isento =====
if printf '%s' "$CMD" | grep -qE "${CMDPOS}(git[[:space:]]+push|gh[[:space:]]+pr[[:space:]]+(create|merge))"; then
  UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)
  if [ -n "$UPSTREAM" ]; then
    RANGE_FILES=$(git diff --name-only "$UPSTREAM"..HEAD 2>/dev/null)
    # Nada a publicar => allow (push vazio/no-op)
    [ -z "$RANGE_FILES" ] && exit 0
  else
    # Branch nova sem upstream: avaliar o ultimo commit (heuristica conservadora)
    RANGE_FILES=$(git diff --name-only HEAD~1..HEAD 2>/dev/null)
  fi
  if [ -n "$RANGE_FILES" ]; then
    NONDOC=$(printf '%s\n' "$RANGE_FILES" | grep -vE "$DOCS_ONLY_RE")
    [ -z "$NONDOC" ] && exit 0
  fi
fi

# ===== 2) QA verdict para o SHA atual =====
[ ! -f "$VFILE" ] && block "nenhum QA verdict registrado ($VFILE ausente) — o @qa nao rodou neste ciclo."

VERDICT="" ; VSHA=""
if command -v jq >/dev/null 2>&1; then
  VERDICT=$(jq -r '.verdict // empty' "$VFILE" 2>/dev/null)
  VSHA=$(jq -r '.sha // empty' "$VFILE" 2>/dev/null)
fi
[ -z "$VERDICT" ] && VERDICT=$(grep -oE '"verdict"[[:space:]]*:[[:space:]]*"[^"]*"' "$VFILE" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')
[ -z "$VSHA" ] && VSHA=$(grep -oE '"sha"[[:space:]]*:[[:space:]]*"[^"]*"' "$VFILE" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')

case "$VERDICT" in
  PASS|WAIVED) : ;;
  CONCERNS) block "ultimo verdict do @qa e CONCERNS — precisa de OK explicito do usuario (override) ou voltar ao @dev." ;;
  FAIL) block "ultimo verdict do @qa e FAIL — devolver ao @dev, nao publicar." ;;
  *) block "verdict invalido/ausente em qa-verdict.json ('$VERDICT')." ;;
esac

[ -z "$VSHA" ] && block "qa-verdict.json sem campo 'sha' — verdict nao esta ancorado a um commit."

if [ "$VSHA" != "$HEAD_SHA" ]; then
  if git cat-file -e "$VSHA" 2>/dev/null && git merge-base --is-ancestor "$VSHA" HEAD 2>/dev/null; then
    EXTRA=$(git diff --name-only "$VSHA"..HEAD 2>/dev/null | grep -vE "$DOCS_ONLY_RE")
    [ -n "$EXTRA" ] && block "QA PASS e para $(printf '%.8s' "$VSHA"), mas HEAD ($(printf '%.8s' "$HEAD_SHA")) tem mudancas de CODIGO alem do verdict: $(printf '%s' "$EXTRA" | head -3 | tr '\n' ' '). Cada deploy = pipeline nova — re-rodar @qa."
  else
    block "qa-verdict.json aponta SHA desconhecido/nao-ancestral ($VSHA) — verdict de outro ciclo/branch. Re-rodar @qa para o HEAD atual."
  fi
fi

# ===== 3) Evidencia de spawn real do aivoux-qa (anti INLINE_DEGRADED) =====
COMMIT_TS=$(git log -1 --format=%ct "$VSHA" 2>/dev/null)
QA_SPAWN=""
if [ -f "$LOG" ] && [ -n "$COMMIT_TS" ]; then
  QA_SPAWN=$(awk -v t="$COMMIT_TS" '$2 == "aivoux-qa" && $1 >= t' "$LOG" 2>/dev/null | tail -1)
fi
[ -z "$QA_SPAWN" ] && block "qa-verdict.json existe mas NAO ha registro de spawn do subagent aivoux-qa apos o commit validado (agents-run.log). Verdict inline = INLINE_DEGRADED, nao vale como PASS. Spawnar aivoux-qa de verdade."

# ===== 4) critical_paths precisam de '## Smoke' (senao o regression gate e teatro) =====
CPS=""
if [ -f "$CONFIG" ]; then
  INLINE=$(sed -n 's/^[[:space:]]*critical_paths:[[:space:]]*\[\(.*\)\].*/\1/p' "$CONFIG" | head -1)
  if [ -n "$INLINE" ]; then
    CPS=$(printf '%s' "$INLINE" | tr ',' '\n' | sed 's/#.*//' | tr -d ' "' | grep -v '^$')
  else
    CPS=$(awk '/^[[:space:]]*critical_paths:[[:space:]]*(#.*)?$/{f=1;next}
               f && /^[[:space:]]*-[[:space:]]*/{line=$0; gsub(/^[[:space:]]*-[[:space:]]*/,"",line); gsub(/[[:space:]]*#.*$/,"",line); gsub(/"/,"",line); if(line!="")print line; next}
               f && !/^[[:space:]]*#/{exit}' "$CONFIG" 2>/dev/null)
  fi
fi
MISSING=""
for slug in $CPS; do
  DOC="docs/features/$slug.md"
  if [ ! -f "$DOC" ] || ! grep -qE '^##[[:space:]]+Smoke' "$DOC" 2>/dev/null; then
    MISSING="$MISSING $slug"
  fi
done
[ -n "$MISSING" ] && block "critical_paths sem secao '## Smoke' em docs/features/:$MISSING — o regression gate nao consegue provar que o coracao do projeto continua vivo. Registrar o smoke (via @scribe ou /aivoux/discover) antes de publicar."

exit 0
