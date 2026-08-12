#!/usr/bin/env bash
# AIVOUX — blast-radius.sh (Regression Gate F4)
# Computa o raio de impacto de um diff de forma DETERMINISTICA:
#   1. arquivos tocados (working tree + staged; ou vs --base <ref>)
#   2. importadores reversos (quem importa os arquivos tocados)
#   3. features afetadas (cruzamento com docs/features/*.md)
#   4. presenca de secao "## Smoke" em cada feature afetada
#
# Uso:
#   bash .claude/hooks/blast-radius.sh                 # diff nao commitado vs HEAD
#   bash .claude/hooks/blast-radius.sh --base main     # diff da branch vs main
#   bash .claude/hooks/blast-radius.sh --last-commit   # ultimo commit (HEAD~1..HEAD)
#   bash .claude/hooks/blast-radius.sh --files a.ts b.ts   # arquivos PLANEJADOS
#     (usado no PASSO 2.5 do router: no momento do plano o diff ainda esta vazio,
#      entao passa-se a lista de arquivos que o plano PRETENDE tocar. Aterra o
#      '## Risco / Blast' do plano em importadores reais, nao em chute.)
#
# READ-ONLY: nao muta nada. Output em markdown compacto no stdout.
# Consumido pelo router (PASSO 4) e pelo @qa (*regression-check).

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "blast-radius: fora de um repositorio git"; exit 1;
}
cd "$ROOT"

FEATURES_DIR="docs/features"
CONFIG=".aivoux/config.yaml"
SRC_GLOBS=('*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.vue' '*.svelte' '*.py' '*.rb' '*.go' '*.php' '*.sql')
MAX_IMPORTERS=40

# ---------- 1. arquivos tocados ----------
BASE_LABEL="HEAD (uncommitted + staged)"
if [ "${1:-}" = "--files" ]; then
  shift
  BASE_LABEL="arquivos planejados ($# arquivo(s))"
  CHANGED="$(printf '%s\n' "$@" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; /^$/d' | sort -u)"
elif [ "${1:-}" = "--base" ] && [ -n "${2:-}" ]; then
  BASE_LABEL="$2...HEAD"
  CHANGED="$(git diff --name-only "$2"...HEAD -- 2>/dev/null)"
elif [ "${1:-}" = "--last-commit" ]; then
  BASE_LABEL="HEAD~1..HEAD"
  CHANGED="$(git diff --name-only HEAD~1 HEAD -- 2>/dev/null)"
else
  CHANGED="$(printf '%s\n%s\n%s\n' \
    "$(git diff --name-only HEAD -- 2>/dev/null)" \
    "$(git diff --name-only --cached -- 2>/dev/null)" \
    "$(git ls-files --others --exclude-standard 2>/dev/null)" | sort -u | sed '/^$/d')"
  # fallback: working tree limpo -> ultimo commit
  if [ -z "$CHANGED" ]; then
    BASE_LABEL="HEAD~1..HEAD (working tree limpo)"
    CHANGED="$(git diff --name-only HEAD~1 HEAD -- 2>/dev/null)"
  fi
fi

if [ -z "$CHANGED" ]; then
  echo "# Blast Radius"
  echo "Base: $BASE_LABEL"
  echo "Nenhum arquivo alterado detectado. Nada a analisar."
  exit 0
fi

# ---------- 2. importadores reversos ----------
# Para cada arquivo tocado de codigo, procura quem o referencia em imports.
# Heuristica: basename sem extensao; para index.* usa o nome do diretorio pai
# (import de pasta). Nomes genericos demais sao pulados para nao gerar ruido.
IMPORTERS=""
GENERIC_NAMES="index main app types utils constants config"

while IFS= read -r f; do
  case "$f" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.vue|*.svelte|*.py|*.rb|*.go|*.php) : ;;
    *) continue ;;
  esac
  name="$(basename "$f")"; name="${name%.*}"
  if [ "$name" = "index" ]; then
    name="$(basename "$(dirname "$f")")"
  fi
  skip=0
  for g in $GENERIC_NAMES; do [ "$name" = "$g" ] && skip=1; done
  [ $skip -eq 1 ] && continue
  hits="$(git grep -lE "(import|require|from)[^;]*['\"/.]${name}['\"./]" -- "${SRC_GLOBS[@]}" 2>/dev/null | grep -vxF "$f" || true)"
  [ -n "$hits" ] && IMPORTERS="$(printf '%s\n%s' "$IMPORTERS" "$hits")"
done <<< "$CHANGED"

IMPORTERS="$(printf '%s\n' "$IMPORTERS" | sed '/^$/d' | sort -u | head -n "$MAX_IMPORTERS")"

# ---------- 3. features afetadas ----------
# Feature e afetada se o doc dela menciona qualquer path tocado/importador
# (path completo ou basename), ou se o slug aparece no path de algum arquivo.
AFFECTED=""      # linhas: slug|docpath|smoke_status
SCOPE="$(printf '%s\n%s\n' "$CHANGED" "$IMPORTERS" | sed '/^$/d' | sort -u)"

if [ -d "$FEATURES_DIR" ]; then
  for doc in "$FEATURES_DIR"/*.md; do
    [ -e "$doc" ] || continue
    slug="$(basename "$doc" .md)"
    [ "$slug" = "index" ] && continue
    hit=0
    while IFS= read -r p; do
      [ -z "$p" ] && continue
      base="$(basename "$p")"
      if grep -qF "$p" "$doc" 2>/dev/null || grep -qF "$base" "$doc" 2>/dev/null; then
        hit=1; break
      fi
      case "$p" in *"$slug"*) hit=1; break ;; esac
    done <<< "$SCOPE"
    if [ $hit -eq 1 ]; then
      if grep -q '^## Smoke' "$doc" 2>/dev/null; then
        n="$(awk '/^## Smoke/{f=1;next} /^## /{f=0} f && /^- /{c++} END{print c+0}' "$doc")"
        if [ "$n" -gt 0 ]; then smoke="SMOKE_OK ($n passo(s))"; else smoke="SEM_SMOKE (secao vazia)"; fi
      else
        smoke="SEM_SMOKE"
      fi
      AFFECTED="$(printf '%s\n%s|%s|%s' "$AFFECTED" "$slug" "$doc" "$smoke")"
    fi
  done
fi
AFFECTED="$(printf '%s\n' "$AFFECTED" | sed '/^$/d')"

# ---------- 4. critical paths do config ----------
CRITICAL=""
if [ -f "$CONFIG" ]; then
  CRITICAL="$(awk '
    /^regression_gate:/ {rg=1; next}
    rg && /^[a-zA-Z_]/ {rg=0}
    rg && /critical_paths:/ {
      # forma inline: critical_paths: [a, b]
      if (match($0, /\[.*\]/)) {
        s=substr($0, RSTART+1, RLENGTH-2); gsub(/[ ,]+/, "\n", s); print s; next
      }
      cp=1; next
    }
    rg && cp && /^[[:space:]]*-[[:space:]]*/ {gsub(/^[[:space:]]*-[[:space:]]*/,""); print; next}
    rg && cp {cp=0}
  ' "$CONFIG" | sed '/^$/d')"
fi

# ---------- output ----------
echo "# Blast Radius"
echo "Base: $BASE_LABEL"
echo ""
echo "## Arquivos tocados ($(printf '%s\n' "$CHANGED" | sed '/^$/d' | wc -l | tr -d ' '))"
printf '%s\n' "$CHANGED" | sed 's/^/- /'
echo ""
echo "## Importadores reversos ($(printf '%s\n' "$IMPORTERS" | sed '/^$/d' | wc -l | tr -d ' '))"
if [ -n "$IMPORTERS" ]; then
  printf '%s\n' "$IMPORTERS" | sed 's/^/- /'
else
  echo "- (nenhum detectado)"
fi
echo ""
echo "## Features afetadas"
if [ ! -d "$FEATURES_DIR" ]; then
  echo "- docs/features/ NAO existe — rode /aivoux/discover para semear a memoria."
  echo "- Regression gate opera CEGO neste projeto: reportar ao usuario."
elif [ -n "$AFFECTED" ]; then
  printf '%s\n' "$AFFECTED" | while IFS='|' read -r slug doc smoke; do
    echo "- \`$slug\` · $doc · $smoke"
  done
else
  echo "- (nenhuma feature documentada intersecta o diff)"
fi
echo ""
echo "## Critical paths (smoke roda SEMPRE, mesmo fora do raio)"
if [ -n "$CRITICAL" ]; then
  printf '%s\n' "$CRITICAL" | while IFS= read -r c; do
    doc="$FEATURES_DIR/$c.md"
    if [ -f "$doc" ] && grep -q '^## Smoke' "$doc" 2>/dev/null; then
      echo "- \`$c\` · $doc · SMOKE_OK"
    elif [ -f "$doc" ]; then
      echo "- \`$c\` · $doc · SEM_SMOKE"
    else
      echo "- \`$c\` · doc NAO encontrada em $doc"
    fi
  done
else
  echo "- (nenhum configurado em regression_gate.critical_paths)"
fi
echo ""
echo "> SEM_SMOKE = feature afetada NAO verificavel. @qa deve reportar"
echo "> explicitamente no handoff — nunca omitir. Vide regression-gate.md."
