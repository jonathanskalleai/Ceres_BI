#!/usr/bin/env bash
set -euo pipefail

echo "== filesystem =="
df -h /
echo
free -h 2>/dev/null || true

echo
echo "== docker system =="
docker system df
if docker buildx version >/dev/null 2>&1; then
  echo
  docker buildx du 2>/dev/null | sed -n '1,80p' || true
fi

echo
echo "== container resources =="
docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' 2>/dev/null || true

echo
echo "== large host directories =="
for path in /var/lib/docker /var/log /var/log/journal /var/log/etl /var/backups /opt /home; do
  if [[ -e "${path}" ]]; then
    du -sh "${path}" 2>/dev/null || true
  fi
done

db_container="$(docker ps --filter 'label=com.docker.swarm.service.name=supabase_supabase_db' --format '{{.ID}}' | head -n 1)"
if [[ -n "${db_container}" ]]; then
  echo
  echo "== postgres logical sizes =="
  docker exec "${db_container}" psql -U postgres -d postgres -Atc \
    "SELECT datname || E'\\t' || pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datallowconn ORDER BY pg_database_size(datname) DESC;"
fi
