#!/usr/bin/env bash
# Local SQL check for the household migrations and tests (no Supabase, no tokens): a throwaway PostgreSQL 16 with stubbed Supabase roles/auth/storage
# and a minimal pgTAP shim (supabase/tests/local/stubs.sql). Applies migrations 1..N, then runs supabase/tests/household_*.test.sql.
# Usage (as root; needs the postgresql-16 server binaries): bash tools/sql_local_test.sh   -> prints ok / NOT OK counts per test file.
# It is a pre-check only: the agreed dry-run and applies on the staging database still follow.
set -e
D=/var/tmp/hhpg; B=/usr/lib/postgresql/16/bin; PORT=55432; cd "$(dirname "$0")/.."
pkill -u postgres -f "postgres -D $D/data" 2>/dev/null || true; sleep 1; rm -rf $D; mkdir -p $D; chown postgres $D
su -s /bin/bash postgres -c "$B/initdb -D $D/data -A trust -U postgres >/dev/null && $B/pg_ctl -D $D/data -o '-k $D -p $PORT -c listen_addresses=' -l $D/log -w start >/dev/null"
P="psql -h $D -p $PORT -U postgres -q"
$P -v ON_ERROR_STOP=1 -d postgres -c "create database hh"
$P -v ON_ERROR_STOP=1 -d hh -f supabase/tests/local/stubs.sql
for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 -d hh -f "$f" >/dev/null || { echo "MIGRATION FAILED: $f"; exit 1; }; done
for t in supabase/tests/household_*.test.sql; do
  o=$($P -d hh -f "$t" 2>&1); echo "$(basename "$t"): ok=$(echo "$o" | grep -c 'NOTICE:  ok - ') not_ok=$(echo "$o" | grep -c 'NOT OK') errors=$(echo "$o" | grep -c 'ERROR')"
  echo "$o" | grep -E "NOT OK|ERROR" | cut -c1-300 | head -5
done
su -s /bin/bash postgres -c "$B/pg_ctl -D $D/data -m fast stop >/dev/null"; rm -rf $D
