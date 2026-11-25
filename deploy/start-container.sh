#!/bin/sh
set -eu

if [ "${REPROLOOP_MODE:-}" = local ]; then
  password="$(cat /run/reproloop/db-password)"
  export DATABASE_URL="postgresql://reproloop:${password}@db:5432/reproloop"
  export AUTH_SECRET="$(cat /run/reproloop/auth-secret)"
  export REPROLOOP_SETUP_TOKEN="$(cat /run/reproloop/setup-token)"
fi

exec "$@"
