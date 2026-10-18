#!/usr/bin/env bash
# Applies the Supabase migrations to a throwaway local Postgres and runs the RLS checks.
# Needs Postgres 15+ binaries (brew install postgresql@15). Leaves nothing running.
set -euo pipefail
export LC_ALL=${LC_ALL:-en_US.UTF-8}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
PGBIN=${PGBIN:-$(dirname "$(command -v initdb || echo /opt/homebrew/opt/postgresql@15/bin/initdb)")}
PORT=${PORT:-54329}
DATA=$(mktemp -d)
trap '"$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT

"$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" -l "$DATA/log" -w start >/dev/null

psql() { "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
psql -f "$ROOT/supabase/tests/supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do psql -f "$f"; done
psql -f "$ROOT/supabase/tests/rls.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /' | grep -v '^$'
echo "Database checks passed."
