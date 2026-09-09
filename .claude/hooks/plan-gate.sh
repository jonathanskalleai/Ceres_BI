#!/usr/bin/env bash
# AIVOUX plan-gate — PreToolUse (Task|Agent), BLOQUEANTE
#
# Plan-First (F7): NENHUMA implementacao comeca sem um plano da SOLUCAO escrito
# ANTES. Resposta ao padrao real: bug/feature "analisado e corrigido na naba",
# sem planejar abordagem/arquivos/blast/validacao — o fix sobe e gera OUTRO erro.
# O diagnostico do PASSO 1 entende o PROBLEMA; o plano do PASSO 2.5 desenha a
# SOLUCAO. Este gate torna o plano mecanico, nao dependente de a IA lembrar.
#
# Regra: spawn de aivoux-dev / aivoux-data-engineer (os agentes que MUTAM codigo
# e schema) e BLOQUEADO ate existir .aivoux/gates/plan.md valido:
#   - ancorado ao HEAD atual (sha == HEAD, ou ancestral de HEAD — tolera o loop
#     dev<->reviewer onde o @dev commita entre rodadas);
#   - fresco (< 90 min — plano de outra demanda envelhece e nao vale);
#   - com as 5 secoes obrigatorias preenchidas (## Abordagem, ## Arquivos,
#     ## Risco/Blast, ## Suposicao mais fraca, ## Validar) e conteudo
#     nao-trivial (anti-teatro).
#
# Contrato (igual delete-guard/deploy-gate): exit 2 + stderr => Claude ve o
# feedback e NAO executa. Projeto fora de git ou sem os agentes-alvo => exit 0.
# Falha interna do hook => exit 0 (nunca travar por bug do hook).
set +e

INPUT=""
[ ! -t 0 ] && INPUT=$(cat 2>/dev/null)
[ -z "$INPUT" ] && INPUT="$CLAUDE_TOOL_INPUT"
[ -z "$INPUT" ] && exit 0

SUB=""
if command -v jq >/dev/null 2>&1; then
  SUB=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // empty' 2>/dev/null)
fi
[ -z "$SUB" ] && SUB=$(printf '%s' "$INPUT" \
  | grep -oE '"subagent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
  | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')

# So gateia os agentes que IMPLEMENTAM (mutam codigo/schema). Planejadores
# (architect, pm, analyst, ux), review (reviewer, security), qa e scribe passam.
case "$SUB" in
  aivoux-dev|aivoux-data-engineer) : ;;
  *) exit 0 ;;
esac

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0
GATES=".aivoux/gates"
PLAN="$GATES/plan.md"

# Fora de repo git => nao ha como ancorar o plano a um SHA; nao bloquear.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null)
[ -z "$HEAD_SHA" ] && exit 0

block() {
  {
    printf '⛔ AIVOUX plan-gate: spawn de %s BLOQUEADO (Plan-First F7).\n' "$SUB"
    printf '   Motivo: %s\n\n' "$1"
    printf 'Regra: NENHUMA implementacao comeca sem um plano da SOLUCAO escrito antes.\n'
    printf 'O diagnostico (PASSO 1) entende o problema; o plano (PASSO 2.5) desenha a\n'
    printf 'solucao — abordagem, arquivos, o que pode QUEBRAR e como validar. Sem isso\n'
    printf 'o fix sobe na naba e gera outro erro.\n\n'
    printf 'Como desbloquear: escrever %s (o router faz no PASSO 2.5)\n' "$PLAN"
    printf 'com o formato abaixo, ancorado ao HEAD atual (%.8s):\n\n' "$HEAD_SHA"
    printf '  # AIVOUX Plan\n'
    printf '  sha: %s\n' "$HEAD_SHA"
    printf '  timestamp: <ISO-8601 UTC>\n'
    printf '  demanda: <resumo em 1 linha>\n'
    printf '  complexidade: SIMPLE|MEDIUM|COMPLEX\n\n'
    printf '  ## Abordagem\n  <como vou resolver — a solucao, nao o sintoma>\n\n'
    printf '  ## Arquivos\n  <arquivos/areas que vou tocar>\n\n'
    printf '  ## Risco / Blast\n  <o que mais depende disso; o que pode quebrar —\n'
    printf '   aterrar em: blast-radius.sh --files <arquivos planejados>>\n\n'
    printf '  ## Suposicao mais fraca\n  <a auto-critica: qual a suposicao que, se\n'
    printf '   errada, quebra o plano; o que pode quebrar que voce NAO listou>\n\n'
    printf '  ## Validar\n  <como PROVO que funcionou + que nao regrediu>\n\n'
    printf 'SIMPLE = 1 linha por secao basta; MEDIUM+ usa Discussion Mode/@architect\n'
    printf 'e consolida o resultado aqui. Detalhes em .claude/rules/plan-first.md.\n\n'
    printf 'Override (so com autorizacao EXPLICITA do usuario nesta conversa): criar\n'
    printf '%s/skip-plan-authorized com a citacao literal da autorizacao (uso unico,\n' "$GATES"
    printf 'logado em %s/overrides.log). NAO crie sem o usuario mandar.\n' "$GATES"
  } >&2
  exit 2
}

# ===== 0) Override autorizado pelo usuario (uso unico, auditado) =====
OVR="$GATES/skip-plan-authorized"
if [ -f "$OVR" ]; then
  mkdir -p "$GATES" 2>/dev/null
  {
    printf '%s OVERRIDE plan-gate sub=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SUB"
    sed 's/^/  autorizacao: /' "$OVR" 2>/dev/null
  } >> "$GATES/overrides.log" 2>/dev/null
  rm -f "$OVR" 2>/dev/null
  printf '⚠ AIVOUX plan-gate: override autorizado consumido (uso unico, logado em %s/overrides.log).\n' "$GATES" >&2
  exit 0
fi

# ===== 1) Plano existe =====
[ ! -f "$PLAN" ] && block "nenhum plano registrado ($PLAN ausente) — voce ia implementar sem planejar a solucao."

# ===== 2) Plano fresco (< 90 min) =====
if [ -n "$(find "$PLAN" -mmin +90 2>/dev/null)" ]; then
  block "plano existe mas esta velho (>90 min) — provavelmente de outra demanda. Reescreva o plano para ESTA demanda."
fi

# ===== 3) Plano ancorado ao HEAD (== ou ancestral, para tolerar loop dev<->reviewer) =====
PSHA=$(grep -iE '^[[:space:]]*sha:' "$PLAN" | head -1 | sed -E 's/^[^:]*:[[:space:]]*//' | tr -d ' \t\r')
[ -z "$PSHA" ] && block "plano sem campo 'sha:' — nao esta ancorado a um commit. Adicione 'sha: $HEAD_SHA'."
if [ "$PSHA" != "$HEAD_SHA" ]; then
  if git cat-file -e "$PSHA" 2>/dev/null && git merge-base --is-ancestor "$PSHA" HEAD 2>/dev/null; then
    : # ancestral de HEAD => ok (o @dev commitou entre rodadas do loop com o @reviewer)
  else
    block "plano aponta SHA desconhecido/nao-ancestral ($(printf '%.8s' "$PSHA")) — e de outro ciclo/branch. Reescreva o plano ancorado ao HEAD atual ($(printf '%.8s' "$HEAD_SHA"))."
  fi
fi

# ===== 4) Secoes obrigatorias presentes =====
# Abordagem/Arquivos/Validar = o plano. Risco/Blast = alavanca 1 (aterrada no
# blast-radius). Suposicao mais fraca = alavanca 2 (auto-critica mecanizada:
# forcar o campo forca a critica a virar artefato — bash nao julga qualidade,
# mas garante que a pergunta foi respondida).
MISS=""
grep -qiE '^##[[:space:]]+Abordagem'  "$PLAN" || MISS="$MISS Abordagem"
grep -qiE '^##[[:space:]]+Arquivos'   "$PLAN" || MISS="$MISS Arquivos"
grep -qiE '^##[[:space:]]+Risco'      "$PLAN" || MISS="$MISS Risco/Blast"
grep -qiE '^##[[:space:]]+Suposicao'  "$PLAN" || MISS="$MISS Suposicao-mais-fraca"
grep -qiE '^##[[:space:]]+Validar'    "$PLAN" || MISS="$MISS Validar"
[ -n "$MISS" ] && block "plano incompleto — faltam secoes obrigatorias:$MISS."

# ===== 5) Anti-teatro: conteudo nao-trivial fora dos headers/frontmatter =====
BODY_LEN=$(grep -vE '^[[:space:]]*(#|sha:|timestamp:|demanda:|complexidade:|$)' "$PLAN" 2>/dev/null | tr -d '[:space:]' | wc -c | tr -d ' ')
if [ "${BODY_LEN:-0}" -lt 60 ]; then
  block "plano quase vazio (${BODY_LEN} chars de conteudo) — headers preenchidos com nada nao e plano. Descreva abordagem, arquivos e validacao de verdade."
fi

exit 0
