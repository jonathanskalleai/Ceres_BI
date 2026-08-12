#!/usr/bin/env bash
# AIVOUX security-gate — PreToolUse (Bash + MCP deploy tools), BLOQUEANTE
#
# Hard gate mecanico do security squad: nenhum push/PR/deploy que toca
# SUPERFICIE SENSIVEL (auth, authz/RLS, entrada externa, dados sensiveis,
# upload, infra exposta) sai sem verdict do @security registrado PARA O SHA
# ATUAL, com evidencia de que o aivoux-security RODOU DE FATO como subagent.
#
# CONDICIONAL por design (diferente do deploy-gate, que sempre exige @qa):
# se o range a publicar NAO toca superficie sensivel, o gate passa em silencio
# — seguranca profunda e situacional (vide security-standards.md). Mudanca de
# UI pura / CSS / texto nao paga o custo do @security.
#
# Contrato (igual delete-guard/deploy-gate): exit 2 + stderr => Claude ve o
# feedback e NAO executa. Falha interna do hook => exit 0 (nunca travar por bug
# do proprio hook).
#
# O que valida, na ordem:
#   0. security_gate.enabled: false no config => gate desligado (exit 0).
#   0.1 Override autorizado pelo usuario (.aivoux/gates/skip-security-authorized)
#       — consumido no uso e logado. So com autorizacao EXPLICITA no prompt.
#   1. Detecta superficie sensivel no range (paths + conteudo do diff).
#      Nao-sensivel => exit 0 (gate nao se aplica).
#   2. .aivoux/gates/security-verdict.json existe, verdict SECURE|CONCERNS|WAIVED,
#      sha do verdict == HEAD (commits pos-verdict docs-only sao tolerados).
#   3. agents-run.log comprova spawn real de aivoux-security apos o commit
#      validado — verdict "inline" sem spawnar @security NAO vale.
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
VFILE="$GATES/security-verdict.json"
LOG="$GATES/agents-run.log"

# Fora de repo git => nao ha como ancorar verdict a SHA; nao bloquear.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# ===== 0) Gate desligado no config? =====
if [ -f "$CONFIG" ]; then
  # procura 'enabled: false' DENTRO do bloco security_gate:
  SG_ENABLED=$(awk '/^security_gate:/{f=1;next} f && /^[a-zA-Z]/{exit} f && /enabled:/{print $2; exit}' "$CONFIG" 2>/dev/null)
  [ "$SG_ENABLED" = "false" ] && exit 0
fi

block() {
  {
    printf '⛔ AIVOUX security-gate: push/deploy BLOQUEADO — a mudanca toca superficie SENSIVEL.\n'
    printf '   Motivo: %s\n\n' "$1"
    printf 'Regra: mudanca que toca auth/authz/RLS, entrada externa (endpoint/webhook/\n'
    printf 'form que grava), dados sensiveis (PII/pagamento/token), upload ou infra\n'
    printf 'exposta (CORS/headers/secret/deploy) NAO e publicada sem o @security ter\n'
    printf 'auditado ESTE codigo. Verdict inline sem spawn real de aivoux-security\n'
    printf 'nao vale. VULNERABLE volta ao @dev.\n\n'
    printf 'Superficie detectada: %s\n\n' "$2"
    printf 'Como desbloquear (em ordem de preferencia):\n'
    printf '  1. Rodar o @security: spawnar aivoux-security (apos @reviewer, antes\n'
    printf '     do @qa). Ele grava .aivoux/gates/security-verdict.json com o SHA.\n'
    printf '  2. Falso positivo (a deteccao e heuristica — ex: a palavra "password"\n'
    printf '     so aparece num comentario) OU o usuario AUTORIZOU EXPLICITAMENTE\n'
    printf '     pular a auditoria nesta demanda: criar\n'
    printf '     .aivoux/gates/skip-security-authorized com a citacao/justificativa.\n'
    printf '     Override de USO UNICO, registrado em overrides.log. NAO crie sem o\n'
    printf '     usuario autorizar nesta conversa.\n'
  } >&2
  exit 2
}

# ===== 0.1) Override autorizado pelo usuario (uso unico, auditado) =====
OVR="$GATES/skip-security-authorized"
if [ -f "$OVR" ]; then
  mkdir -p "$GATES" 2>/dev/null
  {
    printf '%s SECURITY-OVERRIDE tool=%s cmd=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$TOOL" "$(printf '%s' "$CMD" | head -c 200)"
    sed 's/^/  autorizacao: /' "$OVR" 2>/dev/null
  } >> "$GATES/overrides.log" 2>/dev/null
  rm -f "$OVR" 2>/dev/null
  printf '⚠ AIVOUX security-gate: override autorizado consumido (uso unico, logado em %s/overrides.log).\n' "$GATES" >&2
  exit 0
fi

HEAD_SHA=$(git rev-parse HEAD 2>/dev/null)
[ -z "$HEAD_SHA" ] && exit 0

DOCS_ONLY_RE='^(docs/|\.aivoux/|\.claude/|.*\.(md|txt)$)'

# ===== 1) Determinar o range a publicar =====
# resolve_base: base para comparar HEAD contra. Prioridade:
#   upstream tracking -> base remota canonica (merge-base p/ pegar TODOS os
#   commits ahead, nao so o do topo — F4) -> HEAD~1 (sem remote) -> empty tree
#   (repo de 1 commit). NAO usa main/master locais: na propria main isso
#   compararia o branch consigo mesmo (range vazio) e cegaria o gate.
resolve_base() {
  local up b mb
  up=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)
  if [ -n "$up" ]; then printf '%s' "$up"; return; fi
  for b in origin/HEAD origin/main origin/master; do
    if git rev-parse --verify -q "$b" >/dev/null 2>&1; then
      mb=$(git merge-base "$b" HEAD 2>/dev/null)
      [ -n "$mb" ] && { printf '%s' "$mb"; return; }
    fi
  done
  if git rev-parse -q --verify HEAD~1 >/dev/null 2>&1; then
    printf 'HEAD~1'
  else
    printf '%s' "$(git hash-object -t tree /dev/null 2>/dev/null)"   # empty tree => todo o HEAD
  fi
}

RANGE=""
if printf '%s' "$CMD" | grep -qE "${CMDPOS}(git[[:space:]]+push|gh[[:space:]]+pr[[:space:]]+(create|merge))"; then
  BASE=$(resolve_base)
  if [ -n "$BASE" ]; then
    RANGE="$BASE..HEAD"
    RANGE_FILES=$(git diff --name-only "$BASE"..HEAD 2>/dev/null)
    [ -z "$RANGE_FILES" ] && exit 0   # nada a publicar => no-op
  else
    RANGE="HEAD"
    RANGE_FILES=$(git show --name-only --format= HEAD 2>/dev/null)
  fi
else
  # deploy de plataforma / MCP: avaliar commits ahead + working tree
  BASE=$(resolve_base)
  [ -n "$BASE" ] && RANGE="$BASE..HEAD" || RANGE="HEAD"
  RANGE_FILES=$(git diff --name-only "$RANGE" 2>/dev/null; git diff --name-only HEAD 2>/dev/null)
fi
RANGE_FILES=$(printf '%s\n' "$RANGE_FILES" | grep -v '^$' | sort -u)
[ -z "$RANGE_FILES" ] && exit 0

# Range docs-only => sem codigo, sem superficie => isento
NONDOC=$(printf '%s\n' "$RANGE_FILES" | grep -vE "$DOCS_ONLY_RE")
[ -z "$NONDOC" ] && exit 0

# ---- Deteccao de superficie sensivel (heuristica deterministica) ----
# Rede GROSSA de proposito: falso positivo custa 1 override; falso negativo
# deixa passar codigo sensivel sem auditoria. Nao substitui o router/@qa#4 —
# e a 3a camada mecanica. Cobre paths + conteudo (raw SQL, secrets em config/CI,
# entrada nao-Express, XSS nao-React, authz) — F3 do proprio @security.
# a) por PATH do arquivo tocado
PATH_RE='(auth|login|signin|signup|session|middleware|guard|rbac|role|permission|permiss|policy|policies|rls|webhook|upload|payment|checkout|billing|stripe|oauth|jwt|password|passwd|credential|secret|token|cors|admin|migrations?/|api/|route\.(ts|js|tsx|jsx)|graphql|resolver|\.env|[Dd]ockerfile|compose|vercel\.json|netlify\.toml|\.tf$|\.github/workflows/)'
SENS_PATHS=$(printf '%s\n' "$NONDOC" | grep -iE "$PATH_RE")

# b) por CONTEUDO adicionado no diff (linhas '+')
DIFF_ADDED=$(git diff "$RANGE" -- $(printf '%s ' $NONDOC) 2>/dev/null | grep -E '^\+' | grep -vE '^\+\+\+')
CONTENT_RE='(bcrypt|argon2|md5\(|sha1\(|jsonwebtoken|jwt\.sign|jwt\.verify|\.cookie\(|set-cookie|createClient\(|service_role|SERVICE_ROLE|dangerouslySetInnerHTML|innerHTML|v-html|insertAdjacentHTML|document\.write|cors\(|Access-Control-Allow-Origin|req\.(body|query|params)|request\.(json|body|formData)|formData\(|event\.body|ctx\.(params|user)|\.params\.|\.query\(|queryRawUnsafe|\.raw\(|CREATE POLICY|ALTER POLICY|GRANT |auth\.|getSession|getUser|signIn|signUp|resetPassword|process\.env|SECRET|API_KEY|PRIVATE_KEY|ACCESS_KEY|sk_live|sk_test|multer|formidable|fileUpload|createReadStream|passport)'
# F1 (regra do segredo): capturar SO o padrao que casou (grep -oiE), NUNCA a
# linha do diff — a linha poderia conter o VALOR de um secret (Set-Cookie, JWT
# service_role). A propria ferramenta de seguranca nao pode vazar o segredo.
SENS_CONTENT=$(printf '%s\n' "$DIFF_ADDED" | grep -oiE "$CONTENT_RE" | sort -u | head -5)

if [ -z "$SENS_PATHS" ] && [ -z "$SENS_CONTENT" ]; then
  exit 0   # nao toca superficie sensivel => gate condicional nao se aplica
fi

SURFACE=""
[ -n "$SENS_PATHS" ]   && SURFACE="paths[$(printf '%s' "$SENS_PATHS" | head -3 | tr '\n' ' ')]"
[ -n "$SENS_CONTENT" ] && SURFACE="$SURFACE conteudo[$(printf '%s' "$SENS_CONTENT" | tr '\n' '|')]"

# ===== 2) Security verdict para o SHA atual =====
[ ! -f "$VFILE" ] && block "nenhum verdict do @security registrado ($VFILE ausente) — o aivoux-security nao auditou este ciclo." "$SURFACE"

VERDICT="" ; VSHA=""
if command -v jq >/dev/null 2>&1; then
  VERDICT=$(jq -r '.verdict // empty' "$VFILE" 2>/dev/null)
  VSHA=$(jq -r '.sha // empty' "$VFILE" 2>/dev/null)
fi
[ -z "$VERDICT" ] && VERDICT=$(grep -oE '"verdict"[[:space:]]*:[[:space:]]*"[^"]*"' "$VFILE" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')
[ -z "$VSHA" ] && VSHA=$(grep -oE '"sha"[[:space:]]*:[[:space:]]*"[^"]*"' "$VFILE" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')

case "$VERDICT" in
  SECURE|WAIVED) : ;;
  CONCERNS) block "ultimo verdict do @security e CONCERNS — precisa de OK explicito do usuario (override) ou voltar ao @dev para tratar." "$SURFACE" ;;
  VULNERABLE) block "ultimo verdict do @security e VULNERABLE (CRITICAL/HIGH) — devolver ao @dev, NAO publicar." "$SURFACE" ;;
  FAIL) block "ultimo verdict do @security e FAIL — devolver ao @dev." "$SURFACE" ;;
  *) block "verdict invalido/ausente em security-verdict.json ('$VERDICT')." "$SURFACE" ;;
esac

[ -z "$VSHA" ] && block "security-verdict.json sem campo 'sha' — verdict nao esta ancorado a um commit." "$SURFACE"

if [ "$VSHA" != "$HEAD_SHA" ]; then
  if git cat-file -e "$VSHA" 2>/dev/null && git merge-base --is-ancestor "$VSHA" HEAD 2>/dev/null; then
    EXTRA=$(git diff --name-only "$VSHA"..HEAD 2>/dev/null | grep -vE "$DOCS_ONLY_RE")
    [ -n "$EXTRA" ] && block "@security SECURE e para $(printf '%.8s' "$VSHA"), mas HEAD ($(printf '%.8s' "$HEAD_SHA")) tem mudancas de CODIGO alem do verdict: $(printf '%s' "$EXTRA" | head -3 | tr '\n' ' '). Cada deploy = auditoria nova — re-rodar @security." "$SURFACE"
  else
    block "security-verdict.json aponta SHA desconhecido/nao-ancestral ($VSHA) — verdict de outro ciclo/branch. Re-rodar @security para o HEAD atual." "$SURFACE"
  fi
fi

# ===== 3) Evidencia de spawn real do aivoux-security (anti inline) =====
COMMIT_TS=$(git log -1 --format=%ct "$VSHA" 2>/dev/null)
SEC_SPAWN=""
if [ -f "$LOG" ] && [ -n "$COMMIT_TS" ]; then
  SEC_SPAWN=$(awk -v t="$COMMIT_TS" '$2 == "aivoux-security" && $1 >= t' "$LOG" 2>/dev/null | tail -1)
fi
[ -z "$SEC_SPAWN" ] && block "security-verdict.json existe mas NAO ha registro de spawn do subagent aivoux-security apos o commit validado (agents-run.log). Verdict inline nao vale como auditoria. Spawnar aivoux-security de verdade." "$SURFACE"

exit 0
