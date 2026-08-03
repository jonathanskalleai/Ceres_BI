#!/usr/bin/env bash
# AIVOUX docs-gate — PreToolUse (Task|Agent), BLOQUEANTE
#
# Enforcement mecanico do Feature-Docs Lookup (router.md PASSO 1, F6 Regra 8).
# Incidente real: o router pulou a leitura de docs/features/index.md (seguiu a
# copia resumida/antiga do CLAUDE.md em vez do router.md canonico) e os
# subagentes trabalharam sem a memoria do projeto. A linha `Docs:` do ▶ era a
# unica prova — e prosa nao segura.
#
# Regra: se o projeto TEM docs/features/index.md, NENHUM subagent aivoux-*
# (exceto aivoux-scribe, que escreve as docs) pode ser spawnado antes de o
# index ter sido lido nesta janela de trabalho (marker docs-lookup, TTL 60min,
# gravado pelo docs-lookup-trace.sh em qualquer Read/Bash que toque o index).
#
# Contrato: exit 2 + stderr => Claude ve o feedback, NAO executa, faz o lookup
# e re-spawna. Projeto sem index => exit 0 (lookup = "nenhum", nada a cobrar).
# Falha interna => exit 0 (nunca travar por bug do hook).
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

# So agentes do squad AIVOUX; @scribe e isento (e quem escreve as docs).
case "$SUB" in
  aivoux-scribe|"") exit 0 ;;
  aivoux-*) : ;;
  *) exit 0 ;;
esac

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
INDEX="$PROJECT_DIR/docs/features/index.md"
[ ! -f "$INDEX" ] && exit 0

MARKER="$PROJECT_DIR/.aivoux/gates/docs-lookup"
if [ -f "$MARKER" ] && [ -z "$(find "$MARKER" -mmin +60 2>/dev/null)" ]; then
  exit 0
fi

{
  printf '⛔ AIVOUX docs-gate: spawn de %s BLOQUEADO — Feature-Docs Lookup nao feito (PASSO 1).\n\n' "$SUB"
  printf 'Este projeto TEM memoria em docs/features/ e voce ia spawnar um subagent\n'
  printf 'sem ela — o agente pode alucinar ou redescobrir o que ja esta documentado.\n\n'
  printf 'Antes de re-spawnar (custa ~1 Read):\n'
  printf '  1. Read docs/features/index.md (isso destrava este gate automaticamente)\n'
  printf '  2. Match de keywords da demanda contra as linhas do indice\n'
  printf '  3. Se houver match: Read do(s) doc(s) (MAX 2) e incluir o conteudo no\n'
  printf '     prompt do subagent sob "Feature docs (memoria do projeto):"\n'
  printf '  4. Anunciar/atualizar a linha "Docs:" do ▶ com os slugs (ou "nenhum")\n\n'
  printf 'Fonte canonica: .claude/commands/aivoux/router.md PASSO 1 — em divergencia\n'
  printf 'com qualquer resumo do CLAUDE.md, o router.md VENCE.\n'
} >&2
exit 2
