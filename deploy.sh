#!/usr/bin/env bash
#
# Ceres BI — deploy script for the production VPS (Docker Swarm + Traefik).
#
# Run on the VPS, from the repo root, as the REPO OWNER (NOT with sudo in front):
#   bash deploy.sh
#
# git runs as your normal user (so .git stays owned by you, never root); only the
# docker commands are elevated via `sudo` and will prompt for your password once.
# Do NOT prefix the whole script with sudo — that makes git pull run as root and
# leaves .git root-owned.
#
# PREREQUISITE: a persistent .env MUST exist in this directory on the VPS.
# It is NOT tracked in git (contains VITE_SUPABASE_* values) and the Docker
# build inlines those VITE_* vars into the bundle at BUILD TIME. No .env =>
# a broken bundle pointing at undefined Supabase config.
#
# Flow: fetch the chosen release branch -> build both local images with the
# exact Git SHA -> deploy those immutable tags -> verify the running services.
set -euo pipefail

STACK_NAME="ceresbi"

smoke_check() {
  local url="$1"
  local label="$2"
  local attempt

  # Traefik can briefly return 404 while it replaces the backend task. Retry
  # the public route so a healthy rolling deploy is not reported as failed.
  for attempt in 1 2 3 4 5 6; do
    if curl --fail --silent --show-error --max-time 20 "${url}" >/dev/null; then
      return 0
    fi
    if [ "${attempt}" -lt 6 ]; then
      echo "==> ${label} not ready yet (attempt ${attempt}/6); retrying..."
      sleep 3
    fi
  done

  echo "ERROR: ${label} did not become available after 6 attempts." >&2
  return 1
}

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $(pwd). Create it before deploying." >&2
  exit 1
fi

read_env_value() {
  # Deliberately do not `source .env`: VITE values are build input, not shell
  # code. The Docker build still receives the file in its build context.
  sed -n "s/^$1=//p" .env | tail -n 1
}

DEPLOY_BRANCH="$(read_env_value DEPLOY_BRANCH)"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-release/bi-consolidacao-fase-1}"
CERESBI_AI_OPENROUTER_API_KEY="$(read_env_value CERESBI_AI_OPENROUTER_API_KEY)"
CERESBI_AI_DATABASE_URL="$(read_env_value CERESBI_AI_DATABASE_URL)"
CERESBI_AI_JOB_TOKEN="$(read_env_value CERESBI_AI_JOB_TOKEN)"
CERESBI_AI_YA_AGENT_V2_ENABLED="$(read_env_value CERESBI_AI_YA_AGENT_V2_ENABLED)"
CERESBI_AI_YA_AGENT_V2_ENABLED="${CERESBI_AI_YA_AGENT_V2_ENABLED:-false}"
VITE_YA_AGENT_V2_ENABLED="$(read_env_value VITE_YA_AGENT_V2_ENABLED)"
VITE_ERROR_TRACKING_ENDPOINT="$(read_env_value VITE_ERROR_TRACKING_ENDPOINT)"
VITE_SUPABASE_URL="$(read_env_value VITE_SUPABASE_URL)"
VITE_SUPABASE_PUBLISHABLE_KEY="$(read_env_value VITE_SUPABASE_PUBLISHABLE_KEY)"
VITE_SUPABASE_SERVICE_ROLE_KEY="$(read_env_value VITE_SUPABASE_SERVICE_ROLE_KEY)"
SUPABASE_JWT_SECRET="${SUPABASE_JWT_SECRET:-$(read_env_value SUPABASE_JWT_SECRET)}"
export CERESBI_AI_OPENROUTER_API_KEY CERESBI_AI_DATABASE_URL CERESBI_AI_JOB_TOKEN CERESBI_AI_YA_AGENT_V2_ENABLED SUPABASE_JWT_SECRET

for required in CERESBI_AI_OPENROUTER_API_KEY CERESBI_AI_DATABASE_URL CERESBI_AI_JOB_TOKEN SUPABASE_JWT_SECRET; do
  if [ -z "${!required:-}" ]; then
    echo "ERROR: ${required} is missing from .env" >&2
    exit 1
  fi
done

for required in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY; do
  if [ -z "${!required:-}" ]; then
    echo "ERROR: ${required} is missing from .env" >&2
    exit 1
  fi
done

if [ -n "${VITE_SUPABASE_SERVICE_ROLE_KEY}" ]; then
  echo "ERROR: VITE_SUPABASE_SERVICE_ROLE_KEY must never be configured for the web build" >&2
  exit 1
fi

if [ "${CERESBI_AI_YA_AGENT_V2_ENABLED}" = "true" ]; then
  if [ "${VITE_YA_AGENT_V2_ENABLED}" != "true" ]; then
    echo "ERROR: VITE_YA_AGENT_V2_ENABLED must be true when the AI v2 service is enabled" >&2
    exit 1
  fi
  if [ -z "${VITE_ERROR_TRACKING_ENDPOINT}" ]; then
    echo "ERROR: VITE_ERROR_TRACKING_ENDPOINT is required for a v2 production release" >&2
    exit 1
  fi
fi

if [ ! -d .git ]; then
  echo "ERROR: $(pwd) is not a Git checkout. Restore it with the documented VPS bootstrap first." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: deployment checkout has tracked changes. Commit/stash them before deploying." >&2
  exit 1
fi

echo "==> Fetching origin/${DEPLOY_BRANCH}..."
git fetch origin --prune
git checkout -B "${DEPLOY_BRANCH}" "origin/${DEPLOY_BRANCH}"

GIT_SHA="$(git rev-parse --short=12 HEAD)"
CERESBI_WEB_IMAGE="ceresbi:${GIT_SHA}"
CERESBI_AI_IMAGE="ceresbi-ai:${GIT_SHA}"
export CERESBI_WEB_IMAGE CERESBI_AI_IMAGE

echo "==> Building web image ${CERESBI_WEB_IMAGE}..."
docker build \
  --build-arg "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" \
  --build-arg "VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}" \
  --build-arg "VITE_YA_AGENT_V2_ENABLED=${VITE_YA_AGENT_V2_ENABLED}" \
  --build-arg "VITE_ERROR_TRACKING_ENDPOINT=${VITE_ERROR_TRACKING_ENDPOINT}" \
  -t "${CERESBI_WEB_IMAGE}" .

if [ "${CERESBI_AI_YA_AGENT_V2_ENABLED}" = "true" ] && ! docker run --rm --entrypoint sh "${CERESBI_WEB_IMAGE}" -c 'grep -R -F -q "/api/ai/v2/chat/stream" /usr/share/nginx/html'; then
  echo "ERROR: the web bundle does not contain the v2 streaming route" >&2
  exit 1
fi

echo "==> Building AI image ${CERESBI_AI_IMAGE}..."
docker build -t "${CERESBI_AI_IMAGE}" ai-service

echo "==> Deploying stack ${STACK_NAME}..."
docker stack deploy --detach=false -c docker-stack.yml "${STACK_NAME}"

# `docker stack deploy --detach=false` converges both services to the immutable
# tags. Avoid a second concurrent service update: on single-node Swarm that can
# race the stack reconciliation and return `update out of sequence`.
echo "==> Stack services converged; verifying immutable images..."

for service in web ai; do
  actual_image="$(docker service inspect --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' "${STACK_NAME}_${service}")"
  expected_image="${CERESBI_WEB_IMAGE}"
  [ "${service}" = "ai" ] && expected_image="${CERESBI_AI_IMAGE}"
  if [ "${actual_image}" != "${expected_image}" ]; then
    echo "ERROR: ${STACK_NAME}_${service} is using ${actual_image}, expected ${expected_image}" >&2
    exit 1
  fi
done

actual_v2_flag="$(docker service inspect --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' "${STACK_NAME}_ai" | sed -n 's/^YA_AGENT_V2_ENABLED=//p' | tail -n 1)"
if [ "${actual_v2_flag}" != "${CERESBI_AI_YA_AGENT_V2_ENABLED}" ]; then
  echo "ERROR: ${STACK_NAME}_ai has YA_AGENT_V2_ENABLED=${actual_v2_flag:-<unset>}, expected ${CERESBI_AI_YA_AGENT_V2_ENABLED}" >&2
  exit 1
fi

echo "==> Smoke checks..."
smoke_check https://ceresbi.vouxconsultoria.com.br/ "Web"
smoke_check https://ceresbi.vouxconsultoria.com.br/api/ai/health "AI"

if [ "${CERESBI_AI_YA_AGENT_V2_ENABLED}" = "true" ]; then
  v2_health="$(curl --fail --silent --show-error --max-time 20 https://ceresbi.vouxconsultoria.com.br/api/ai/v2/health)"
  if ! printf '%s' "${v2_health}" | grep -Eq '"enabled"[[:space:]]*:[[:space:]]*true'; then
    echo "ERROR: v2 health did not report enabled=true" >&2
    exit 1
  fi
  if ! printf '%s' "${v2_health}" | grep -Eq '"supports_tools"[[:space:]]*:[[:space:]]*true'; then
    echo "ERROR: v2 health did not report provider tool support" >&2
    exit 1
  fi
  if ! printf '%s' "${v2_health}" | grep -Eq '"tool_count"[[:space:]]*:[[:space:]]*10'; then
    echo "ERROR: v2 health did not report the complete tool catalog" >&2
    exit 1
  fi
fi

echo "==> Done: ${GIT_SHA} is running in web and AI."
