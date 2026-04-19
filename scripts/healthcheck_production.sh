#!/usr/bin/env bash
set -euo pipefail

WEB_URL="${WEB_HEALTHCHECK_URL:-http://127.0.0.1:${WEB_PORT:-3000}}"
API_URL="${API_HEALTHCHECK_URL:-http://127.0.0.1:${API_PORT:-4000}/health}"

echo "Checking API: ${API_URL}"
curl -fsS "${API_URL}"
echo
echo "Checking Web: ${WEB_URL}"
curl -fsS "${WEB_URL}" >/dev/null
echo "Healthchecks passed."
