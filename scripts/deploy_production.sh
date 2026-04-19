#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_ENV_FILE="${APP_ENV_FILE:-${ROOT_DIR}/deploy/production/app.env}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.production.yml}"

if [[ ! -f "${APP_ENV_FILE}" ]]; then
  echo "Missing env file: ${APP_ENV_FILE}" >&2
  echo "Copy deploy/production/app.env.example to deploy/production/app.env first." >&2
  exit 1
fi

set -a
source "${APP_ENV_FILE}"
set +a

docker compose -f "${COMPOSE_FILE}" --env-file "${APP_ENV_FILE}" pull || true
docker compose -f "${COMPOSE_FILE}" --env-file "${APP_ENV_FILE}" up -d --remove-orphans
"${ROOT_DIR}/scripts/healthcheck_production.sh"
