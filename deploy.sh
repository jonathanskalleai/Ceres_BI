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

docker_cmd() {
  # The VPS operator is intentionally not in the docker group. Preserve only
  # deployment configuration needed by Compose interpolation and explicitly
  # remove credential values before sudo starts the Docker client.
  sudo -E env \
    -u CERESBI_AI_OPENROUTER_API_KEY \
    -u CERESBI_AI_DATABASE_URL \
    -u CERESBI_AI_JOB_TOKEN \
    -u SUPABASE_JWT_SECRET \
    docker "$@"
}

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
VITE_BI_API_ENABLED="$(read_env_value VITE_BI_API_ENABLED)"
# The Python gateway is the production BI boundary.  A rollback uses the
# previous immutable web image; disabling the flag would make this release
# fail closed rather than returning to direct browser-to-Postgres reads.
VITE_BI_API_ENABLED="${VITE_BI_API_ENABLED:-true}"
VITE_BI_API_BASE_URL="$(read_env_value VITE_BI_API_BASE_URL)"
VITE_BI_API_BASE_URL="${VITE_BI_API_BASE_URL:-/api/bi}"
VITE_ERROR_TRACKING_ENDPOINT="${VITE_ERROR_TRACKING_ENDPOINT:-$(read_env_value VITE_ERROR_TRACKING_ENDPOINT)}"
VITE_ERROR_TRACKING_ENDPOINT="${VITE_ERROR_TRACKING_ENDPOINT:-https://ceresbi.vouxconsultoria.com.br/api/ai/telemetry}"
VITE_SUPABASE_URL="$(read_env_value VITE_SUPABASE_URL)"
VITE_SUPABASE_PUBLISHABLE_KEY="$(read_env_value VITE_SUPABASE_PUBLISHABLE_KEY)"
VITE_SUPABASE_SERVICE_ROLE_KEY="$(read_env_value VITE_SUPABASE_SERVICE_ROLE_KEY)"
CERESBI_BI_DATABASE_URL_SECRET="$(read_env_value CERESBI_BI_DATABASE_URL_SECRET)"
CERESBI_BI_DATABASE_URL_SECRET="${CERESBI_BI_DATABASE_URL_SECRET:-ceresbi_bi_database_url_v1}"
CERESBI_BI_JWT_SECRET="$(read_env_value CERESBI_BI_JWT_SECRET)"
CERESBI_BI_JWT_SECRET="${CERESBI_BI_JWT_SECRET:-ceresbi_bi_jwt_secret_v1}"
CERESBI_BI_REFRESH_DATABASE_URL_SECRET="$(read_env_value CERESBI_BI_REFRESH_DATABASE_URL_SECRET)"
CERESBI_BI_REFRESH_DATABASE_URL_SECRET="${CERESBI_BI_REFRESH_DATABASE_URL_SECRET:-ceresbi_bi_refresh_database_url_v2}"
CERESBI_BI_DATABASE_POOL_MIN="$(read_env_value CERESBI_BI_DATABASE_POOL_MIN)"
CERESBI_BI_DATABASE_POOL_MAX="$(read_env_value CERESBI_BI_DATABASE_POOL_MAX)"
CERESBI_BI_POOL_WAIT_TIMEOUT_MS="$(read_env_value CERESBI_BI_POOL_WAIT_TIMEOUT_MS)"
CERESBI_BI_LOG_LEVEL="$(read_env_value CERESBI_BI_LOG_LEVEL)"
CERESBI_BI_STATEMENT_TIMEOUT_MS="$(read_env_value CERESBI_BI_STATEMENT_TIMEOUT_MS)"
CERESBI_BI_LOCK_TIMEOUT_MS="$(read_env_value CERESBI_BI_LOCK_TIMEOUT_MS)"
CERESBI_BI_CACHE_TTL_SECONDS="$(read_env_value CERESBI_BI_CACHE_TTL_SECONDS)"
CERESBI_BI_CACHE_MAX_ITEMS="$(read_env_value CERESBI_BI_CACHE_MAX_ITEMS)"
CERESBI_BI_CACHE_MAX_ENTRY_BYTES="$(read_env_value CERESBI_BI_CACHE_MAX_ENTRY_BYTES)"
CERESBI_BI_CORS_ORIGINS="$(read_env_value CERESBI_BI_CORS_ORIGINS)"
CERESBI_DOCKER_BUILD_CACHE_MAX="$(read_env_value CERESBI_DOCKER_BUILD_CACHE_MAX)"
CERESBI_DOCKER_BUILD_CACHE_MAX="${CERESBI_DOCKER_BUILD_CACHE_MAX:-4GB}"
CERESBI_DOCKER_BUILD_CACHE_RESERVED="$(read_env_value CERESBI_DOCKER_BUILD_CACHE_RESERVED)"
CERESBI_DOCKER_BUILD_CACHE_RESERVED="${CERESBI_DOCKER_BUILD_CACHE_RESERVED:-1GB}"
CERESBI_DOCKER_BUILD_CACHE_MIN_FREE="$(read_env_value CERESBI_DOCKER_BUILD_CACHE_MIN_FREE)"
CERESBI_DOCKER_BUILD_CACHE_MIN_FREE="${CERESBI_DOCKER_BUILD_CACHE_MIN_FREE:-15GB}"
CERESBI_DOCKER_BUILD_CACHE_PRUNE_AGE="$(read_env_value CERESBI_DOCKER_BUILD_CACHE_PRUNE_AGE)"
CERESBI_DOCKER_BUILD_CACHE_PRUNE_AGE="${CERESBI_DOCKER_BUILD_CACHE_PRUNE_AGE:-168h}"
CERESBI_DEPLOY_MIN_FREE_GB="$(read_env_value CERESBI_DEPLOY_MIN_FREE_GB)"
CERESBI_DEPLOY_MIN_FREE_GB="${CERESBI_DEPLOY_MIN_FREE_GB:-8}"
CERESBI_AI_OPENROUTER_API_KEY_SECRET="$(read_env_value CERESBI_AI_OPENROUTER_API_KEY_SECRET)"
CERESBI_AI_OPENROUTER_API_KEY_SECRET="${CERESBI_AI_OPENROUTER_API_KEY_SECRET:-ceresbi_ai_openrouter_api_key_v1}"
CERESBI_AI_DATABASE_URL_SECRET="$(read_env_value CERESBI_AI_DATABASE_URL_SECRET)"
CERESBI_AI_DATABASE_URL_SECRET="${CERESBI_AI_DATABASE_URL_SECRET:-ceresbi_ai_database_url_v1}"
CERESBI_AI_JOB_TOKEN_SECRET="$(read_env_value CERESBI_AI_JOB_TOKEN_SECRET)"
CERESBI_AI_JOB_TOKEN_SECRET="${CERESBI_AI_JOB_TOKEN_SECRET:-ceresbi_ai_job_token_v1}"
CERESBI_AI_JWT_SECRET="$(read_env_value CERESBI_AI_JWT_SECRET)"
CERESBI_AI_JWT_SECRET="${CERESBI_AI_JWT_SECRET:-ceresbi_ai_jwt_secret_v1}"
SUPABASE_JWT_SECRET="${SUPABASE_JWT_SECRET:-$(read_env_value SUPABASE_JWT_SECRET)}"
if [ -z "${SUPABASE_JWT_SECRET}" ] && command -v docker >/dev/null 2>&1; then
  SUPABASE_JWT_SECRET="$(docker_cmd service inspect ceresbi_ai --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null | sed -n 's/^SUPABASE_JWT_SECRET=//p' | tail -n 1)"
fi
export CERESBI_AI_OPENROUTER_API_KEY CERESBI_AI_DATABASE_URL CERESBI_AI_JOB_TOKEN CERESBI_AI_YA_AGENT_V2_ENABLED SUPABASE_JWT_SECRET
export CERESBI_BI_DATABASE_URL_SECRET CERESBI_BI_JWT_SECRET CERESBI_BI_REFRESH_DATABASE_URL_SECRET CERESBI_BI_DATABASE_POOL_MIN CERESBI_BI_DATABASE_POOL_MAX CERESBI_BI_POOL_WAIT_TIMEOUT_MS CERESBI_BI_LOG_LEVEL CERESBI_BI_STATEMENT_TIMEOUT_MS CERESBI_BI_LOCK_TIMEOUT_MS CERESBI_BI_CACHE_TTL_SECONDS CERESBI_BI_CACHE_MAX_ITEMS CERESBI_BI_CACHE_MAX_ENTRY_BYTES CERESBI_BI_CORS_ORIGINS CERESBI_AI_OPENROUTER_API_KEY_SECRET CERESBI_AI_DATABASE_URL_SECRET CERESBI_AI_JOB_TOKEN_SECRET CERESBI_AI_JWT_SECRET

for required in CERESBI_AI_OPENROUTER_API_KEY CERESBI_AI_DATABASE_URL CERESBI_AI_JOB_TOKEN; do
  if [ -z "${!required:-}" ]; then
    echo "ERROR: ${required} is missing from .env" >&2
    exit 1
  fi
done

if [ -z "${SUPABASE_JWT_SECRET}" ] && ! docker_cmd secret inspect "${CERESBI_AI_JWT_SECRET}" >/dev/null 2>&1; then
  echo "ERROR: SUPABASE_JWT_SECRET is missing and ${CERESBI_AI_JWT_SECRET} does not exist" >&2
  exit 1
fi

ensure_docker_secret() {
  local secret_name="$1"
  local secret_value="$2"

  if docker_cmd secret inspect "${secret_name}" >/dev/null 2>&1; then
    return 0
  fi
  printf '%s' "${secret_value}" | docker_cmd secret create "${secret_name}" - >/dev/null
  echo "==> Created missing Swarm secret ${secret_name}"
}

for required_secret in "${CERESBI_BI_DATABASE_URL_SECRET}" "${CERESBI_BI_JWT_SECRET}" "${CERESBI_BI_REFRESH_DATABASE_URL_SECRET}"; do
  if ! docker_cmd secret inspect "${required_secret}" >/dev/null 2>&1; then
    echo "ERROR: required Docker secret ${required_secret} does not exist; provision the dedicated BI credentials before deploying" >&2
    exit 1
  fi
done

if [ "${VITE_BI_API_ENABLED}" != "true" ]; then
  echo "ERROR: production releases require VITE_BI_API_ENABLED=true; rollback with the previous immutable image" >&2
  exit 1
fi

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

prune_build_cache() {
  local available_kb
  local minimum_kb
  local prune_log

  available_kb="$(df -Pk / | awk 'NR == 2 { print $4 }')"
  minimum_kb="$((CERESBI_DEPLOY_MIN_FREE_GB * 1024 * 1024))"
  if [ "${available_kb}" -lt "${minimum_kb}" ]; then
    echo "==> Disk is below ${CERESBI_DEPLOY_MIN_FREE_GB} GB free; pruning BuildKit before build..."
  fi

  if ! docker_cmd buildx version >/dev/null 2>&1; then
    echo "ERROR: Docker Buildx is required for bounded build cache" >&2
    return 1
  fi

  prune_log="$(mktemp)"
  if ! docker_cmd buildx prune \
    --force \
    --filter "until=${CERESBI_DOCKER_BUILD_CACHE_PRUNE_AGE}" \
    --max-used-space "${CERESBI_DOCKER_BUILD_CACHE_MAX}" \
    --reserved-space "${CERESBI_DOCKER_BUILD_CACHE_RESERVED}" \
    --min-free-space "${CERESBI_DOCKER_BUILD_CACHE_MIN_FREE}" \
    >"${prune_log}" 2>&1; then
    tail -n 30 "${prune_log}" >&2
    rm -f "${prune_log}"
    return 1
  fi
  tail -n 3 "${prune_log}"
  rm -f "${prune_log}"

  available_kb="$(df -Pk / | awk 'NR == 2 { print $4 }')"
  if [ "${available_kb}" -lt "${minimum_kb}" ]; then
    echo "ERROR: insufficient disk after BuildKit pruning; refusing to build" >&2
    return 1
  fi
}

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

if [ -x ops/install-vps-runtime.sh ]; then
  echo "==> Applying idempotent VPS runtime retention configuration..."
  sudo ops/install-vps-runtime.sh
fi

echo "==> Bounding Docker build cache (${CERESBI_DOCKER_BUILD_CACHE_MAX} max)..."
prune_build_cache

GIT_SHA="$(git rev-parse --short=12 HEAD)"
CERESBI_WEB_IMAGE="ceresbi:${GIT_SHA}"
CERESBI_AI_IMAGE="ceresbi-ai:${GIT_SHA}"
CERESBI_BI_IMAGE="ceresbi-bi:${GIT_SHA}"
export CERESBI_WEB_IMAGE CERESBI_AI_IMAGE
export CERESBI_BI_IMAGE

echo "==> Building web image ${CERESBI_WEB_IMAGE}..."
docker_cmd build \
  --build-arg "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" \
  --build-arg "VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}" \
  --build-arg "VITE_YA_AGENT_V2_ENABLED=${VITE_YA_AGENT_V2_ENABLED}" \
  --build-arg "VITE_ERROR_TRACKING_ENDPOINT=${VITE_ERROR_TRACKING_ENDPOINT}" \
  --build-arg "VITE_BI_API_ENABLED=${VITE_BI_API_ENABLED}" \
  --build-arg "VITE_BI_API_BASE_URL=${VITE_BI_API_BASE_URL}" \
  -t "${CERESBI_WEB_IMAGE}" .

if [ "${CERESBI_AI_YA_AGENT_V2_ENABLED}" = "true" ] && ! docker_cmd run --rm --entrypoint sh "${CERESBI_WEB_IMAGE}" -c 'grep -R -F -q "/api/ai/v2/chat/stream" /usr/share/nginx/html'; then
  echo "ERROR: the web bundle does not contain the v2 streaming route" >&2
  exit 1
fi

echo "==> Building AI image ${CERESBI_AI_IMAGE}..."
docker_cmd build -t "${CERESBI_AI_IMAGE}" ai-service

echo "==> Building BI image ${CERESBI_BI_IMAGE}..."
docker_cmd build -t "${CERESBI_BI_IMAGE}" bi-service

# Create the secrets only after validation and all image builds passed. Failed
# preflights/builds must not leave new credentials behind in Swarm.
ensure_docker_secret "${CERESBI_AI_OPENROUTER_API_KEY_SECRET}" "${CERESBI_AI_OPENROUTER_API_KEY}"
ensure_docker_secret "${CERESBI_AI_DATABASE_URL_SECRET}" "${CERESBI_AI_DATABASE_URL}"
ensure_docker_secret "${CERESBI_AI_JOB_TOKEN_SECRET}" "${CERESBI_AI_JOB_TOKEN}"
if [ -n "${SUPABASE_JWT_SECRET}" ]; then
  ensure_docker_secret "${CERESBI_AI_JWT_SECRET}" "${SUPABASE_JWT_SECRET}"
fi

echo "==> Deploying stack ${STACK_NAME}..."
docker_cmd stack deploy --detach=false -c docker-stack.yml "${STACK_NAME}"

# `docker stack deploy --detach=false` converges both services to the immutable
# tags. Avoid a second concurrent service update: on single-node Swarm that can
# race the stack reconciliation and return `update out of sequence`.
echo "==> Stack services converged; verifying immutable images..."

for service in web ai bi bi_refresh; do
  actual_image="$(docker_cmd service inspect --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' "${STACK_NAME}_${service}")"
  expected_image="${CERESBI_WEB_IMAGE}"
  [ "${service}" = "ai" ] && expected_image="${CERESBI_AI_IMAGE}"
  [ "${service}" = "bi" ] && expected_image="${CERESBI_BI_IMAGE}"
  [ "${service}" = "bi_refresh" ] && expected_image="${CERESBI_BI_IMAGE}"
  if [ "${actual_image}" != "${expected_image}" ]; then
    echo "ERROR: ${STACK_NAME}_${service} is using ${actual_image}, expected ${expected_image}" >&2
    exit 1
  fi
done

echo "==> Waiting for web, AI, BI and refresh tasks..."
for attempt in $(seq 1 30); do
  all_ready=true
  for service in web ai bi bi_refresh; do
    replicas="$(docker_cmd service ls --filter "name=${STACK_NAME}_${service}" --format '{{.Replicas}}' | head -n 1)"
    if [ "${replicas}" != "1/1" ]; then
      all_ready=false
      break
    fi
  done
  if [ "${all_ready}" = true ]; then
    break
  fi
  if [ "${attempt}" -eq 30 ]; then
    echo "ERROR: stack tasks did not converge to 1/1" >&2
    docker_cmd service ls --filter "name=${STACK_NAME}_" >&2 || true
    exit 1
  fi
  sleep 2
done

actual_v2_flag="$(docker_cmd service inspect --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' "${STACK_NAME}_ai" | sed -n 's/^YA_AGENT_V2_ENABLED=//p' | tail -n 1)"
if [ "${actual_v2_flag}" != "${CERESBI_AI_YA_AGENT_V2_ENABLED}" ]; then
  echo "ERROR: ${STACK_NAME}_ai has YA_AGENT_V2_ENABLED=${actual_v2_flag:-<unset>}, expected ${CERESBI_AI_YA_AGENT_V2_ENABLED}" >&2
  exit 1
fi

echo "==> Smoke checks..."
smoke_check https://ceresbi.vouxconsultoria.com.br/ "Web"
smoke_check https://ceresbi.vouxconsultoria.com.br/api/ai/health "AI"
smoke_check https://ceresbi.vouxconsultoria.com.br/api/bi/health "BI"

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

echo "==> Done: ${GIT_SHA} is running in web, AI, BI and BI refresh (flag=${VITE_BI_API_ENABLED})."
