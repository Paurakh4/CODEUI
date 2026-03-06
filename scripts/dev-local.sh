#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

echo "Preparing MongoDB..."
bash "${SCRIPT_DIR}/setup-mongodb-macos.sh"

LISTEN_PID="$(lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null | head -n1 || true)"
if [[ -n "${LISTEN_PID}" ]]; then
  LISTEN_CMD="$(ps -p "${LISTEN_PID}" -o command= 2>/dev/null || true)"
  if echo "${LISTEN_CMD}" | grep -q "next-server"; then
    echo "Next dev server is already running on http://localhost:3000 (pid ${LISTEN_PID})."
    echo "Reusing existing server."
    exit 0
  fi
fi

if [[ -f ".next/dev/lock" ]]; then
  echo "Stale Next.js lock found at .next/dev/lock. Removing stale lock..."
  rm -f ".next/dev/lock"
fi

echo "Starting Next.js development server..."
pnpm dev
