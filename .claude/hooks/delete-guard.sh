#!/usr/bin/env bash
# AIVOUX delete-guard — PreToolUse (Bash|Write|Edit|NotebookEdit)
#
# Teeth DETERMINISTICO contra delecao/sobrescrita destrutiva de arquivos
# criticos (.env, chaves, .git, secrets) e rm -rf de diretorios nao-seguros.
# Resposta direta ao incidente real: @devops apagou .env sem perguntar e
# "nao soube explicar o motivo". Regra em prosa nao basta para algo destrutivo —
# este hook BLOQUEIA fisicamente, independente de o agente lembrar da regra.
#
# Contrato: exit 2 + mensagem em stderr => Claude ve o feedback, NAO executa,
# e DEVE pedir autorizacao explicita ao usuario (que entao roda manualmente).
# Qualquer falha interna => exit 0 (nunca travar o usuario por bug do hook).
#
# Politica:
# - rm/unlink/shred/truncate de arquivo protegido        -> BLOQUEIA
# - sobrescrever (Write/Edit) arquivo protegido EXISTENTE -> BLOQUEIA
#   (criar um .env novo do zero e PERMITIDO — e assim que se restaura)
# - rm -rf de raiz/home/cwd/glob (/, ~, ., *)             -> BLOQUEIA
# - rm -r de diretorio NAO reconhecido como seguro        -> BLOQUEIA
#   (node_modules/dist/build/cache/etc sao auto-permitidos)
# - git clean -x/-X (remove ignorados, inclui .env)       -> BLOQUEIA
# - truncamento de .env via '>' redirect                  -> BLOQUEIA
# - find ... -delete / -exec rm tocando protegido         -> BLOQUEIA
set +e

INPUT=""
[ ! -t 0 ] && INPUT=$(cat 2>/dev/null)
[ -z "$INPUT" ] && INPUT="$CLAUDE_TOOL_INPUT"
[ -z "$INPUT" ] && exit 0

# --- extrair tool_name, command, file_path (jq se houver, senao grep) ---
TOOL="" ; CMD="" ; FILE=""
if command -v jq >/dev/null 2>&1; then
  TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)
  CMD=$(printf '%s'  "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
  FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
fi
[ -z "$TOOL" ] && TOOL=$(printf '%s' "$INPUT" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')
[ -z "$FILE" ] && FILE=$(printf '%s' "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')

# Arquivos protegidos (qualquer caminho/basename que case). .git diretorio incluido.
PROTECTED='(^|/|[[:space:]"'"'"'=])\.env($|[^a-zA-Z0-9._-])|\.env\.(local|production|prod|development|dev|staging|test|secret)|\.pem([^a-zA-Z]|$)|\.key([^a-zA-Z]|$)|\.p12|\.pfx|\.keystore|id_rsa|id_ed25519|id_dsa|(^|/)secrets?/|(^|/)secrets?\b|(^|/)credentials|\.npmrc|\.netrc|(^|/)\.aws/|serviceaccount|\.pgpass|(^|/)\.git(/|$|[[:space:]])'
# .env.example/sample/template/dist sao versionados e seguros
SAFE_ENV='\.env\.(example|sample|template|dist)'

block() {
  printf '⛔ AIVOUX delete-guard: operacao destrutiva BLOQUEADA.\n   %s\n\n' "$1" >&2
  printf 'Regra agent-conduct.md (NEVER): nunca deletar/sobrescrever conteudo\n' >&2
  printf 'sem autorizacao EXPLICITA do usuario. Isto inclui .env, chaves e segredos.\n' >&2
  printf 'PARE. Explique ao usuario o que pretende deletar e por que, e deixe\n' >&2
  printf 'que ELE confirme/execute. Nao tente contornar nem repetir o comando.\n' >&2
  exit 2
}

# ===== Tools de escrita: bloquear sobrescrita de arquivo protegido EXISTENTE =====
case "$TOOL" in
  Write|Edit|NotebookEdit)
    [ -z "$FILE" ] && exit 0
    printf '%s' "$FILE" | grep -qE "$SAFE_ENV" && exit 0
    if printf '%s' "$FILE" | grep -qE "$PROTECTED" && [ -e "$FILE" ]; then
      block "Sobrescrever arquivo protegido existente: '$FILE' (criar do zero e permitido; sobrescrever nao)."
    fi
    exit 0
    ;;
esac

# ===== Bash =====
[ "$TOOL" != "Bash" ] && exit 0
[ -z "$CMD" ] && exit 0
LC="$CMD"

# IMPORTANTE: so contamos um verbo destrutivo quando ele esta em POSICAO DE COMANDO
# (inicio de linha, ou apos ; & | && || ou abertura de parenteses), nunca quando
# aparece no meio de uma frase. Isso evita falso-positivo em mensagens de commit,
# echo/printf e comentarios que apenas MENCIONAM "rm" / ".env". grep e por-linha,
# entao o casamento exige verbo + alvo na MESMA linha de comando.
CMDPOS='(^|[;&|(])[[:space:]]*'

# 1) rm recursivo em raiz/home/cwd/glob — SEMPRE bloqueia
if printf '%s' "$LC" | grep -qE "${CMDPOS}rm[[:space:]]+(-[a-zA-Z]*[rR][a-zA-Z]*[[:space:]]+)+(-[a-zA-Z]+[[:space:]]+)*(/|~|\\\$HOME|\\\$\{HOME\}|\.|\*|/\*)([[:space:]]|\$)"; then
  block "rm recursivo em raiz/home/diretorio-atual/glob: '$CMD'"
fi

# 2) rm/unlink/shred/truncate (em posicao de comando) tocando arquivo protegido
#    NA MESMA linha. Pipeline grep|grep|grep mantem o requisito por-linha.
HIT=$(printf '%s' "$LC" \
  | grep -E "${CMDPOS}(rm|unlink|shred|truncate)([[:space:]]|\$)" \
  | grep -E "$PROTECTED" \
  | grep -vE "$SAFE_ENV")
[ -n "$HIT" ] && block "Delecao de arquivo protegido (.env/chave/segredo/.git): '$CMD'"

# 3) truncamento/sobrescrita de .env via '>' (nao '>>'), na mesma linha
if printf '%s' "$LC" | grep -qE '[^>-]>[[:space:]]*[^|;&>]*\.env([^a-zA-Z0-9._-]|$)' && ! printf '%s' "$LC" | grep -qE "$SAFE_ENV"; then
  block "Truncamento/sobrescrita de .env via redirecionamento '>': '$CMD'"
fi

# 4) git clean -x/-X — remove arquivos ignorados (inclui .env)
if printf '%s' "$LC" | grep -qE "${CMDPOS}git[[:space:]]+clean\b" && printf '%s' "$LC" | grep -qE 'clean\b[^;&|]*[[:space:]]-[a-zA-Z]*[xX]'; then
  block "git clean -x/-X remove arquivos ignorados, incluindo .env: '$CMD'"
fi

# 5) rm recursivo (em posicao de comando) de diretorio NAO reconhecido como seguro
SAFE_DIRS='node_modules|dist|build|\.next|\.nuxt|\.cache|\.turbo|coverage|\.parcel-cache|out|\.svelte-kit|__pycache__|\.pytest_cache|\.mypy_cache|target|tmp|\.tmp|\.vite|\.output'
REC=$(printf '%s' "$LC" | grep -E "${CMDPOS}rm[[:space:]]+(-[a-zA-Z]*[rR])")
if [ -n "$REC" ]; then
  UNSAFE=$(printf '%s' "$REC" | grep -vE "/?(${SAFE_DIRS})(/|[[:space:]]|\$)")
  [ -n "$UNSAFE" ] && block "rm recursivo de diretorio nao reconhecido como seguro: '$CMD'. Auto-permitido apenas para node_modules/dist/build/cache e similares."
fi

# 6) find (em posicao de comando) ... -delete / -exec rm tocando arquivo protegido
FIND=$(printf '%s' "$LC" | grep -E "${CMDPOS}find\b" | grep -E '(-delete|-exec[[:space:]]+rm)')
if [ -n "$FIND" ] && printf '%s' "$FIND" | grep -qE "$PROTECTED"; then
  block "find -delete/-exec rm tocando arquivo protegido: '$CMD'"
fi

exit 0
