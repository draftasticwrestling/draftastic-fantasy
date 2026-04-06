#!/usr/bin/env bash
# Dump hosted Supabase Postgres to a gzipped SQL file under ./backups/
#
# What this backs up: all tables, data, and schema in the Postgres database.
# What it does NOT include: Supabase Storage files (images, etc.). For those,
# use the Supabase Dashboard → Storage, or sync the bucket with the S3 API / CLI.
#
# 1. Supabase Dashboard → Project Settings → Database
# 2. Copy "Connection string" → URI (use the direct connection or Session pooler;
#    pg_dump needs a session-capable connection; avoid Transaction pooler for dumps).
# 3. Replace [YOUR-PASSWORD] with your database password.
# 4. Run (do not commit the URL):
#      export SUPABASE_DB_URL='postgresql://...'
#      ./scripts/supabase-pgdump.sh
#
# Or add SUPABASE_DB_URL to .env and run from a shell where it is exported.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONN="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [[ -z "$CONN" ]]; then
  echo "Error: Set SUPABASE_DB_URL or DATABASE_URL to your Postgres connection URI."
  echo "See comments at the top of scripts/supabase-pgdump.sh"
  exit 1
fi

PG_DUMP="$(command -v pg_dump 2>/dev/null || true)"
if [[ -z "$PG_DUMP" && -x /opt/homebrew/opt/libpq/bin/pg_dump ]]; then
  PG_DUMP="/opt/homebrew/opt/libpq/bin/pg_dump"
fi
if [[ -z "$PG_DUMP" ]]; then
  echo "Error: pg_dump not found. Install with: brew install libpq"
  echo "Then add to PATH, e.g.: export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\""
  exit 1
fi

mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/supabase-${STAMP}.sql.gz"

echo "Writing ${OUT} ..."
"$PG_DUMP" "$CONN" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  | gzip -9 > "$OUT"

echo "Done. Size: $(du -h "$OUT" | cut -f1)"
echo "Restore (to empty DB): gunzip -c \"$OUT\" | psql \"\$SUPABASE_DB_URL\""
