#!/usr/bin/env bash
#
# Asserts the core architectural guarantee: the Flowable engine and the
# application domain live in separate Postgres schemas with separate roles, and
# neither role can read the other's schema. The workflow engine therefore cannot
# touch business data, and the application cannot touch engine tables.
#
# Usage: bash scripts/verify-db-isolation.sh   (requires: docker compose up -d)
set -uo pipefail

PG=(docker compose exec -T postgres psql -d neo)
failures=0

check() {
  local description="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  ✓ %s (%s)\n' "$description" "$actual"
  else
    printf '  ✗ %s — expected "%s", got "%s"\n' "$description" "$expected" "$actual"
    failures=$((failures + 1))
  fi
}

echo "Verifying schema isolation..."

check "flowable role has NO usage on app schema" \
  "$("${PG[@]}" -U flowable -tAc "select has_schema_privilege('flowable','app','USAGE');")" "f"

check "app role has NO usage on flowable schema" \
  "$("${PG[@]}" -U app -tAc "select has_schema_privilege('app','flowable','USAGE');")" "f"

check "no table name shared between the two schemas" \
  "$("${PG[@]}" -U postgres -tAc "select count(*) from information_schema.tables f join information_schema.tables a on a.table_name = f.table_name where f.table_schema='flowable' and a.table_schema='app';")" "0"

check "application tables exist (domain schema created)" \
  "$("${PG[@]}" -U postgres -tAc "select (count(*) > 0) from information_schema.tables where table_schema='app' and table_name = 'travel_requests';")" "t"

check "no ACT_* engine tables inside the app schema" \
  "$("${PG[@]}" -U postgres -tAc "select count(*) from information_schema.tables where table_schema='app' and table_name like 'act_%';")" "0"

check "engine tables exist (Flowable schema created)" \
  "$("${PG[@]}" -U postgres -tAc "select (count(*) > 0) from information_schema.tables where table_schema='flowable' and table_name like 'act_%';")" "t"

echo -n "  "
if "${PG[@]}" -U flowable -c "select * from app.users limit 1;" >/dev/null 2>&1; then
  echo "✗ flowable role could read app.users (isolation broken)"
  failures=$((failures + 1))
else
  echo "✓ flowable role is denied reading app.users"
fi

echo -n "  "
if "${PG[@]}" -U app -c "select * from flowable.act_re_procdef limit 1;" >/dev/null 2>&1; then
  echo "✗ app role could read flowable.act_re_procdef (isolation broken)"
  failures=$((failures + 1))
else
  echo "✓ app role is denied reading flowable.act_re_procdef"
fi

if [ "$failures" -eq 0 ]; then
  echo "Schema isolation verified."
  exit 0
fi

echo "Schema isolation FAILED ($failures check(s))."
exit 1
