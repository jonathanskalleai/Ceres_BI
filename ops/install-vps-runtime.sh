#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "execute este instalador com sudo" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

install -d -m 0750 /var/backups/ceresbi
install -m 0750 "${repo_root}/ops/ceresbi-postgres-backup.sh" /usr/local/sbin/ceresbi-postgres-backup
install -m 0750 "${repo_root}/ops/ceresbi-disk-check.sh" /usr/local/sbin/ceresbi-disk-check
install -m 0750 "${repo_root}/ops/ceresbi-disk-report.sh" /usr/local/sbin/ceresbi-disk-report
install -m 0644 "${repo_root}/ops/systemd/ceresbi-postgres-backup.service" /etc/systemd/system/ceresbi-postgres-backup.service
install -m 0644 "${repo_root}/ops/systemd/ceresbi-postgres-backup.timer" /etc/systemd/system/ceresbi-postgres-backup.timer
install -m 0644 "${repo_root}/ops/systemd/ceresbi-disk-check.service" /etc/systemd/system/ceresbi-disk-check.service
install -m 0644 "${repo_root}/ops/systemd/ceresbi-disk-check.timer" /etc/systemd/system/ceresbi-disk-check.timer

systemctl daemon-reload
systemctl enable --now ceresbi-postgres-backup.timer ceresbi-disk-check.timer
systemctl start ceresbi-disk-check.service
