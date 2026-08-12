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
# Flow: pull latest main (as you) -> build local image -> roll the swarm service.
set -euo pipefail

STACK_NAME="ceresbi"
IMAGE_TAG="ceresbi:latest"

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $(pwd). Create it before deploying." >&2
  exit 1
fi

echo "==> Skipping git pull (code deployed via rsync from Mac)..."
# git pull origin main   # disabled — code synced via rsync, no .git present

echo "==> Building image ${IMAGE_TAG}..."
sudo docker build -t "${IMAGE_TAG}" .

echo "==> Deploying stack ${STACK_NAME}..."
sudo docker stack deploy -c docker-stack.yml "${STACK_NAME}"

# Single-node swarm uses a local :latest image with no registry digest, so
# `docker stack deploy` will NOT roll a rebuilt image (same tag, no new digest).
# Force the running task to pick up the freshly built image.
echo "==> Forcing rollout of rebuilt image..."
sudo docker service update --image "${IMAGE_TAG}" --force "${STACK_NAME}_web"

echo "==> Done. Check rollout with: sudo docker stack services ${STACK_NAME}"
