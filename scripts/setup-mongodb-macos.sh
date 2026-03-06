#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This setup script is for macOS only."
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required but not installed."
  echo "Install Homebrew first: https://brew.sh"
  exit 1
fi

if ! command -v mongod >/dev/null 2>&1; then
  echo "MongoDB not found. Installing via Homebrew..."
  brew tap mongodb/brew
  brew install mongodb-community
else
  echo "MongoDB is already installed."
fi

if ! command -v mongosh >/dev/null 2>&1; then
  echo "mongosh not found. Installing shell..."
  brew install mongosh
fi

echo "Starting MongoDB service..."
brew services start mongodb-community >/dev/null 2>&1 || true

MONGO_URI="mongodb://localhost:27017/codeui"
if [[ -f ".env.local" ]]; then
  ENV_URI="$(grep -E '^MONGODB_URI=' .env.local | tail -n1 | sed -E 's/^MONGODB_URI=//')"
  if [[ -n "${ENV_URI}" ]]; then
    MONGO_URI="${ENV_URI}"
  fi
fi

echo "Checking MongoDB connection on ${MONGO_URI} ..."
for _ in {1..20}; do
  if mongosh "${MONGO_URI}" --quiet --eval 'db.runCommand({ ping: 1 }).ok' | grep -q "1"; then
    echo "MongoDB is ready."
    echo "Service status:"
    brew services list | grep -E 'mongodb|mongo' || true
    exit 0
  fi
  sleep 1
done

echo "MongoDB did not become ready in time."
echo "Check logs with: tail -n 100 ~/Library/Logs/Homebrew/mongodb-community/*.log"
exit 1
