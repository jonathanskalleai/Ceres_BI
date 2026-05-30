#!/bin/bash
# AIVOUX Telemetry Hook (v2)
# Registra eventos de uso do Claude Code em .aivoux/telemetry/events.jsonl
# Nunca bloqueia Claude Code — falhas sao silenciosas.
# Dados sao LOCAIS, gitignored, e anonimizados (paths sao hasheados).
#
# Eventos: tool, prompt, stop
# Campos extras (v2): subagent_type (em Agent calls), tier (sessao ativa),
# agent (derivado de subagent_type), model (derivado de subagent_type)

set +e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
TELEMETRY_DIR="$PROJECT_DIR/.aivoux/telemetry"
TELEMETRY_FILE="$TELEMETRY_DIR/events.jsonl"
PROJECT_INFO_FILE="$TELEMETRY_DIR/project.json"

mkdir -p "$TELEMETRY_DIR" 2>/dev/null || exit 0

EVENT_TYPE="${1:-tool}"
INPUT=""
if [ ! -t 0 ]; then
  INPUT=$(cat)
fi

TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# jq is optional — if missing, log minimal event
has_jq() { command -v jq >/dev/null 2>&1; }

# ---------- TIER (cached per session) ----------
get_tier() {
  local tier_file="$PROJECT_DIR/.aivoux/.session-tier"
  local config_file="$PROJECT_DIR/.aivoux/config.yaml"
  local tier=""

  # 1. Session override
  if [ -f "$tier_file" ]; then
    tier=$(grep -E "^tier:" "$tier_file" 2>/dev/null | head -1 | sed -E 's/^tier:[[:space:]]*//;s/#.*$//;s/[[:space:]]+$//')
  fi

  # 2. Config
  if [ -z "$tier" ] && [ -f "$config_file" ]; then
    tier=$(grep -E "^model_tier:" "$config_file" 2>/dev/null | head -1 | sed -E 's/^model_tier:[[:space:]]*//;s/#.*$//;s/[[:space:]]+$//')
  fi

  # 3. Default
  [ -z "$tier" ] && tier="premium"

  echo "$tier"
}

# ---------- SUBAGENT_TYPE → AGENT + MODEL ----------
# aivoux-architect → @architect / opus
# aivoux-architect-economy → @architect / sonnet
# aivoux-dev → @dev / sonnet
# aivoux-scribe → @scribe / haiku
derive_agent_and_model() {
  local st="$1"
  local agent="" model=""

  case "$st" in
    aivoux-analyst)             agent="@analyst";       model="opus" ;;
    aivoux-pm)                  agent="@pm";            model="opus" ;;
    aivoux-architect)           agent="@architect";     model="opus" ;;
    aivoux-ux)                  agent="@ux";            model="opus" ;;
    aivoux-analyst-economy)     agent="@analyst";       model="sonnet" ;;
    aivoux-pm-economy)          agent="@pm";            model="sonnet" ;;
    aivoux-architect-economy)   agent="@architect";     model="sonnet" ;;
    aivoux-ux-economy)          agent="@ux";            model="sonnet" ;;
    aivoux-dev)                 agent="@dev";           model="sonnet" ;;
    aivoux-qa)                  agent="@qa";            model="sonnet" ;;
    aivoux-devops)              agent="@devops";        model="sonnet" ;;
    aivoux-data-engineer)       agent="@data-engineer"; model="sonnet" ;;
    aivoux-squad-creator)       agent="@squad-creator"; model="sonnet" ;;
    aivoux-scribe)              agent="@scribe";        model="haiku" ;;
  esac

  echo "$agent|$model"
}

# ---------- PROJECT INFO (registered once per project) ----------
ensure_project_info() {
  [ -f "$PROJECT_INFO_FILE" ] && return

  local name
  name=$(basename "$PROJECT_DIR" 2>/dev/null)
  local hash
  hash=$(printf '%s' "$PROJECT_DIR" | shasum 2>/dev/null | cut -c1-12)
  local created="$TS"

  printf '{"name":"%s","path_hash":"%s","registered_at":"%s"}\n' \
    "$name" "$hash" "$created" > "$PROJECT_INFO_FILE" 2>/dev/null
}

ensure_project_info

TIER=$(get_tier)

# ---------- EVENT LOGGERS ----------
log_tool() {
  local tool="unknown" file="" ok="true" ext="" fh=""
  local st="" agent="" model="" pair=""

  if has_jq && [ -n "$INPUT" ]; then
    tool=$(echo "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null)
    file=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
    ok=$(echo "$INPUT" | jq -r 'if (.tool_response.error // .tool_response.is_error // false) then "false" else "true" end' 2>/dev/null)

    # If Agent call, capture subagent_type
    if [ "$tool" = "Agent" ] || [ "$tool" = "Task" ]; then
      st=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // empty' 2>/dev/null)
      if [ -n "$st" ]; then
        pair=$(derive_agent_and_model "$st")
        agent="${pair%|*}"
        model="${pair#*|}"
      fi
    fi
  fi

  if [ -n "$file" ]; then
    fh=$(printf '%s' "$file" | shasum 2>/dev/null | cut -c1-8)
    ext="${file##*.}"
    case "$ext" in
      */*|"") ext="" ;;
      *) [ ${#ext} -gt 6 ] && ext="" ;;
    esac
  fi

  printf '{"ts":"%s","type":"tool","tool":"%s","ok":%s,"fh":"%s","ext":"%s","subagent_type":"%s","agent":"%s","model":"%s","tier":"%s"}\n' \
    "$TS" "$tool" "$ok" "$fh" "$ext" "$st" "$agent" "$model" "$TIER" >> "$TELEMETRY_FILE" 2>/dev/null
}

log_prompt() {
  local chars=0
  if has_jq && [ -n "$INPUT" ]; then
    chars=$(echo "$INPUT" | jq -r '.prompt // ""' 2>/dev/null | wc -c | tr -d ' ')
  fi
  printf '{"ts":"%s","type":"prompt","chars":%s,"tier":"%s"}\n' \
    "$TS" "${chars:-0}" "$TIER" >> "$TELEMETRY_FILE" 2>/dev/null
}

log_stop() {
  printf '{"ts":"%s","type":"stop","tier":"%s"}\n' "$TS" "$TIER" >> "$TELEMETRY_FILE" 2>/dev/null
}

case "$EVENT_TYPE" in
  tool) log_tool ;;
  prompt) log_prompt ;;
  stop) log_stop ;;
esac

exit 0
