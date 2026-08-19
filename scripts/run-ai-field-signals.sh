#!/usr/bin/env bash
# Runs only the weekly field-signal pipeline. Useful for a safe backfill or
# manual refresh without also rebuilding the broader team/consultant report.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_FILE="${TMPDIR:-/tmp}/ceresbi-ai-weekly.lock"
BASE_URL="${CERESBI_AI_BASE_URL:-https://ceresbi.vouxconsultoria.com.br/api/ai}"
DAYS="${CERESBI_AI_SIGNALS_DAYS:-14}"
MAX_RECORDS="${CERESBI_AI_SIGNALS_MAX_RECORDS:-1500}"

cd "${REPO_DIR}"
if [ ! -f .env ]; then
  echo "ERROR: .env not found in ${REPO_DIR}" >&2
  exit 1
fi

read_env_value() {
  sed -n "s/^$1=//p" .env | tail -n 1
}

CERESBI_AI_JOB_TOKEN="$(read_env_value CERESBI_AI_JOB_TOKEN)"
CERESBI_AI_BASE_URL="$(read_env_value CERESBI_AI_BASE_URL)"
BASE_URL="${CERESBI_AI_BASE_URL:-${BASE_URL}}"

if [ -z "${CERESBI_AI_JOB_TOKEN:-}" ]; then
  echo "ERROR: CERESBI_AI_JOB_TOKEN is missing from .env" >&2
  exit 1
fi

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Another Ceres BI AI weekly job is already running; skipping."
  exit 0
fi

umask 077
CURL_CONFIG="$(mktemp)"
trap 'rm -f "${CURL_CONFIG}"' EXIT
printf 'header = "X-Ceres-Cron-Token: %s"\n' "${CERESBI_AI_JOB_TOKEN}" > "${CURL_CONFIG}"

echo "==> Structured field signals and narrative"
curl --fail --silent --show-error --max-time 2700 --config "${CURL_CONFIG}" \
  -X POST "${BASE_URL}/generate-weekly-signals?days=${DAYS}&max_records=${MAX_RECORDS}"
echo
