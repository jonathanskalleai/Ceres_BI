#!/usr/bin/env bash
set -euo pipefail

warning_percent="${CERESBI_DISK_WARNING_PERCENT:-80}"
critical_percent="${CERESBI_DISK_CRITICAL_PERCENT:-90}"
usage_percent="$(df -P / | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
free_bytes="$(df -PB1 / | awk 'NR == 2 { print $4 }')"

if (( usage_percent >= critical_percent )); then
  logger -t ceresbi-disk-check -p daemon.crit "root filesystem at ${usage_percent}% (${free_bytes} bytes free)"
  exit 1
fi
if (( usage_percent >= warning_percent )); then
  logger -t ceresbi-disk-check -p daemon.warning "root filesystem at ${usage_percent}% (${free_bytes} bytes free)"
fi
