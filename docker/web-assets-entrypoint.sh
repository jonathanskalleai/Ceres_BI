#!/bin/sh
set -eu

SOURCE_DIR="/opt/ceresbi-assets"
TARGET_DIR="/usr/share/nginx/html/assets"

# The target is a named volume in Swarm. Copying instead of moving lets the
# image remain self-contained for local runs and makes deploys additive: old
# immutable chunks stay available to already-open browser tabs.
if [ -d "$SOURCE_DIR" ]; then
  mkdir -p "$TARGET_DIR"
  cp -a "$SOURCE_DIR"/. "$TARGET_DIR"/
fi

# A release archive or a temporary seed directory may carry restrictive
# permissions (for example 0700 on its parent). Nginx workers run as `nginx`,
# so normalize only this dedicated asset volume after the additive copy.
chmod 755 "$TARGET_DIR"
find "$TARGET_DIR" -type d -exec chmod 755 {} \;
find "$TARGET_DIR" -type f -exec chmod 644 {} \;
