#!/bin/bash
# AIVOUX Security Standard #1 — Pre-commit Secret Scanner
#
# Bloqueia comandos `git commit` quando detecta literais de secrets
# em arquivos staged. Roda antes de qualquer Bash que comece com 'git commit'.
#
# Detecta:
#  - API keys (sk-, pk-, AKIA, ghp_, github_pat_, xoxb-, AIza, ya29.)
#  - Generic secret patterns (api_key="...", password="...", secret="...")
#  - JWT tokens (eyJ...)
#  - Private keys (-----BEGIN ... PRIVATE KEY-----)
#
# Permite:
#  - .env.example com valores vazios ou placeholder
#  - Comentarios e documentacao com "API_KEY" sem valor real

set -euo pipefail

# Apenas roda se o tool em uso for Bash com `git commit`
if [ -z "${CLAUDE_TOOL_INPUT:-}" ]; then
  exit 0
fi

# Extrai o comando do JSON de input (quando disponivel)
COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//' || echo "")

# So roda em git commit
if ! echo "$COMMAND" | grep -qE '^git commit'; then
  exit 0
fi

# Verifica se ha algo staged
if ! git diff --cached --name-only 2>/dev/null | grep -q .; then
  exit 0
fi

# Patterns de secrets conhecidos
SECRET_PATTERNS=(
  'sk-[a-zA-Z0-9]{20,}'
  'sk_live_[a-zA-Z0-9]{20,}'
  'sk_test_[a-zA-Z0-9]{20,}'
  'pk_live_[a-zA-Z0-9]{20,}'
  'AKIA[0-9A-Z]{16}'
  'ghp_[a-zA-Z0-9]{36}'
  'github_pat_[a-zA-Z0-9_]{60,}'
  'xox[baprs]-[a-zA-Z0-9-]{10,}'
  'AIza[a-zA-Z0-9_-]{35}'
  'ya29\.[a-zA-Z0-9_-]+'
  '-----BEGIN [A-Z]+ PRIVATE KEY-----'
  'eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+'
)

# Generic patterns: var assignment com valor que parece secret
GENERIC_PATTERNS=(
  '(api[_-]?key|apikey|secret|password|passwd|token|auth)[[:space:]]*[=:][[:space:]]*["'"'"'][a-zA-Z0-9_/+=]{16,}["'"'"']'
)

FOUND=0
REPORT=""

# Capturar diff staged em variavel para processar uma vez
STAGED_DIFF=$(git diff --cached -U0 2>/dev/null || echo "")

if [ -z "$STAGED_DIFF" ]; then
  exit 0
fi

# Filtrar apenas linhas adicionadas (comecam com +, mas nao +++)
ADDED_LINES=$(echo "$STAGED_DIFF" | grep -E '^\+[^+]' || echo "")

if [ -z "$ADDED_LINES" ]; then
  exit 0
fi

for pattern in "${SECRET_PATTERNS[@]}"; do
  MATCHES=$(echo "$ADDED_LINES" | grep -oE -e "$pattern" || true)
  if [ -n "$MATCHES" ]; then
    FOUND=1
    REPORT="${REPORT}- Pattern: ${pattern}\n  Matches: $(echo "$MATCHES" | head -3)\n"
  fi
done

for pattern in "${GENERIC_PATTERNS[@]}"; do
  MATCHES=$(echo "$ADDED_LINES" | grep -iEo "$pattern" || true)
  if [ -n "$MATCHES" ]; then
    # Excluir falsos positivos: .env.example, placeholders, vazio
    REAL=$(echo "$MATCHES" | grep -viE '(your[_-]?key|placeholder|example|xxxx|<.*>|"")' || true)
    if [ -n "$REAL" ]; then
      FOUND=1
      REPORT="${REPORT}- Generic secret pattern detected:\n  $(echo "$REAL" | head -3)\n"
    fi
  fi
done

if [ $FOUND -eq 1 ]; then
  echo ""
  echo "🚨 AIVOUX Security Standard #1 — SECRET DETECTED IN COMMIT"
  echo ""
  echo "Possivel(eis) secret(s) encontrado(s) em arquivos staged:"
  echo ""
  printf "%b" "$REPORT"
  echo ""
  echo "Acoes:"
  echo "  1. Mover o secret para .env (e adicionar .env ao .gitignore)"
  echo "  2. Usar process.env.NOME no codigo"
  echo "  3. Re-stage e tentar commit novamente"
  echo ""
  echo "Override (NAO RECOMENDADO): SKIP_SECRET_SCAN=1 git commit ..."
  echo ""

  # Permite override explicito
  if [ "${SKIP_SECRET_SCAN:-0}" = "1" ]; then
    echo "⚠ SKIP_SECRET_SCAN=1 detected — proceeding under user responsibility"
    exit 0
  fi

  exit 2
fi

exit 0
