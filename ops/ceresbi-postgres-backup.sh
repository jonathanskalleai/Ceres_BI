#!/usr/bin/env bash
set -euo pipefail

umask 077
backup_dir="/var/backups/ceresbi"
timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
backup_path="${backup_dir}/postgres-${timestamp}.dump"
partial_path="${backup_path}.partial"

install -d -m 0700 "${backup_dir}"

db_container="$(docker ps --filter 'label=com.docker.swarm.service.name=supabase_supabase_db' --format '{{.ID}}' | head -n 1)"
if [[ -z "${db_container}" ]]; then
  echo "PostgreSQL container is not running" >&2
  exit 1
fi

trap 'rm -f "${partial_path}" "${partial_path}.sha256"' EXIT
docker exec "${db_container}" pg_dump -U postgres -d postgres -Fc >"${partial_path}"
test -s "${partial_path}"
sha256sum "${partial_path}" >"${partial_path}.sha256"
mv "${partial_path}" "${backup_path}"
mv "${partial_path}.sha256" "${backup_path}.sha256"
trap - EXIT

printf 'PostgreSQL backup created: %s (%s bytes)\n' "${backup_path}" "$(stat -c '%s' "${backup_path}")"
