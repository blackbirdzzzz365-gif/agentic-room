#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_ENV_FILE="${APP_ENV_FILE:-${ROOT_DIR}/deploy/production/app.env}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.production.yml}"

docker compose -f "${COMPOSE_FILE}" --env-file "${APP_ENV_FILE}" down
