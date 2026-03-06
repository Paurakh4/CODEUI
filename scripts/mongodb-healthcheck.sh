#!/usr/bin/env bash

set -euo pipefail

if ! command -v mongosh >/dev/null 2>&1; then
  echo "mongosh is not installed."
  exit 1
fi

MONGO_URI="mongodb://localhost:27017/codeui"
if [[ -f ".env.local" ]]; then
  ENV_URI="$(grep -E '^MONGODB_URI=' .env.local | tail -n1 | sed -E 's/^MONGODB_URI=//')"
  if [[ -n "${ENV_URI}" ]]; then
    MONGO_URI="${ENV_URI}"
  fi
fi

echo "MongoDB service status:"
if command -v brew >/dev/null 2>&1; then
  brew services list | grep -E 'mongodb|mongo' || true
fi

echo "Pinging ${MONGO_URI} ..."
RESULT="$(mongosh "${MONGO_URI}" --quiet --eval 'JSON.stringify(db.runCommand({ ping: 1 }))')"
echo "${RESULT}"

if echo "${RESULT}" | grep -q '"ok":1'; then
  echo "MongoDB healthcheck passed."
  exit 0
fi

echo "MongoDB healthcheck failed."
exit 1
