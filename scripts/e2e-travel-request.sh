#!/usr/bin/env bash
#
# End-to-end workflow test for the Travel Request Approval process.
# Drives the real API, so it needs the full stack running:
#   docker compose up -d          # Postgres + Flowable workflow service
#   pnpm --filter api dev         # API on :3001
#
# Scenario A: below-threshold request, no receipts  -> supervisor -> APPROVED
# Scenario B: above-threshold request, receipts     -> employee sign-off ->
#             supervisor -> finance -> REJECTED
set -euo pipefail

API="${API_BASE_URL:-http://localhost:3001/api}"
COOKIES="$(mktemp -d)"
trap 'rm -rf "$COOKIES"' EXIT

failures=0
assert_eq() {
  local description="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  ✓ %s\n' "$description"
  else
    printf '  ✗ %s — expected "%s", got "%s"\n' "$description" "$expected" "$actual"
    failures=$((failures + 1))
  fi
}

login() { # jar, email
  curl -s -c "$1" -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$2\",\"password\":\"password\"}" >/dev/null
}
submit() { curl -s -b "$COOKIES/emp.txt" -X POST "$API/requests" -H 'Content-Type: application/json' -d "$1"; }
status_of() { curl -s -b "$COOKIES/emp.txt" "$API/requests/$1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])'; }
task_id() { curl -s -b "$1" "$API/tasks" | python3 -c "import sys,json;d=json.load(sys.stdin);m=[t for t in d if t['taskKey']=='$2'];print(m[0]['id'] if m else '')"; }
poll_task() { # jar, taskKey, tries
  local i=0
  while [ "$i" -lt "$3" ]; do
    local id; id="$(task_id "$1" "$2")"
    [ -n "$id" ] && { echo "$id"; return 0; }
    sleep 0.5; i=$((i + 1))
  done
  echo ""
}
decide() { curl -s -b "$1" -X POST "$API/tasks/$2/complete" -H 'Content-Type: application/json' -d "{\"decision\":\"$3\",\"comment\":\"$4\"}" >/dev/null; }

echo "Waiting for the API..."
curl -s --retry 40 --retry-delay 2 --retry-connrefused -o /dev/null "$API/auth/me"

login "$COOKIES/emp.txt" employee1@neo.dev
login "$COOKIES/mgr.txt" manager1@neo.dev
login "$COOKIES/fin.txt" finance1@neo.dev

echo
echo "Scenario A — no receipts, below finance threshold"
A=$(submit '{"title":"Client workshop","destination":"Amsterdam","startDate":"2026-10-12","endDate":"2026-10-13","currency":"EUR","hasReceipts":false,"items":[{"category":"TRANSPORT","description":"Train","amount":180,"receiptRequired":false}]}')
AID=$(printf '%s' "$A" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
assert_eq "submitted into supervisor queue" "$(status_of "$AID")" "PENDING_MANAGER"
MT=$(poll_task "$COOKIES/mgr.txt" managerApproval 40)
assert_eq "supervisor task appeared" "$([ -n "$MT" ] && echo yes || echo no)" "yes"
decide "$COOKIES/mgr.txt" "$MT" APPROVED "Approved, enjoy the trip"
sleep 1
assert_eq "final status" "$(status_of "$AID")" "COMPLETED"

echo
echo "Scenario B — receipts + above finance threshold, then finance rejects"
B=$(submit '{"title":"Vendor summit","destination":"San Francisco","startDate":"2026-11-02","endDate":"2026-11-06","currency":"USD","hasReceipts":true,"items":[{"category":"TRANSPORT","description":"Flight","amount":980,"receiptRequired":true},{"category":"LODGING","description":"Hotel","amount":720,"receiptRequired":true}]}')
BID=$(printf '%s' "$B" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
BT=$(poll_task "$COOKIES/emp.txt" employeeSignAndSubmit 40)
assert_eq "async receipt step produced the employee task" "$([ -n "$BT" ] && echo yes || echo no)" "yes"
assert_eq "status awaiting employee" "$(status_of "$BID")" "PENDING_EMPLOYEE"
decide "$COOKIES/emp.txt" "$BT" APPROVED "signed-doc.pdf"
MT2=$(poll_task "$COOKIES/mgr.txt" managerApproval 40)
decide "$COOKIES/mgr.txt" "$MT2" APPROVED "ok"
FT=$(poll_task "$COOKIES/fin.txt" financeApproval 40)
assert_eq "finance task created (threshold crossed)" "$([ -n "$FT" ] && echo yes || echo no)" "yes"
assert_eq "status awaiting finance" "$(status_of "$BID")" "PENDING_FINANCE"
decide "$COOKIES/fin.txt" "$FT" REJECTED "Over budget"
sleep 1
assert_eq "final status" "$(status_of "$BID")" "REJECTED"

echo
echo "Integrations and attachments"
booking=$(curl -s -b "$COOKIES/emp.txt" "$API/requests/$AID" | python3 -c 'import sys,json;print(json.load(sys.stdin)["bookingReference"] or "")')
assert_eq "approved request was booked by the integration" "$([ -n "$booking" ] && echo yes || echo no)" "yes"
integration_status=$(curl -s -b "$COOKIES/emp.txt" "$API/requests/$AID/integrations" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["status"] if d else "")')
assert_eq "integration call recorded as SUCCESS" "$integration_status" "SUCCESS"
engine_tasks=$(curl -s -b "$COOKIES/emp.txt" "$API/requests/$AID/history" | python3 -c "import sys,json;print('confirmBooking' in [a['activityId'] for a in json.load(sys.stdin)])")
assert_eq "booking task ran in the process" "$engine_tasks" "True"

printf 'signed receipt\n' > "$COOKIES/receipt.txt"
uploaded=$(curl -s -b "$COOKIES/emp.txt" -F "file=@$COOKIES/receipt.txt" "$API/requests/$AID/attachments" | python3 -c 'import sys,json;print(json.load(sys.stdin)["name"])')
assert_eq "attachment uploaded and stored" "$uploaded" "receipt.txt"
stored=$(curl -s -b "$COOKIES/emp.txt" "$API/requests/$AID/attachments" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
assert_eq "attachment listed on the request" "$stored" "1"
assert_eq "unauthenticated upload rejected" \
  "$(curl -s -o /dev/null -w '%{http_code}' -F "file=@$COOKIES/receipt.txt" "$API/requests/$AID/attachments")" "401"

echo
echo "Regression — null-valued process variables"
# TasksService sends `comment: null` when the comment box is empty. A
# Collectors.toMap in the engine facade used to NPE on null values *inside* the
# transactional complete, rolling back a task that had already executed and
# leaving the app and the engine disagreeing. This must complete cleanly.
NID=$(submit '{"title":"Null variable regression","destination":"Kyiv","startDate":"2027-03-01","endDate":"2027-03-02","currency":"EUR","hasReceipts":false,"items":[{"category":"MEALS","description":"Per diem","amount":60,"receiptRequired":false}]}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
NT=$(poll_task "$COOKIES/mgr.txt" managerApproval 40)
null_code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES/mgr.txt" -X POST "$API/tasks/$NT/complete" \
  -H 'Content-Type: application/json' -d '{"decision":"APPROVED"}')
assert_eq "task completes with a null comment" "$null_code" "200"
assert_eq "process ended (not rolled back)" "$(status_of "$NID")" "COMPLETED"
engine_running=$(docker compose exec -T postgres psql -U flowable -d neo -tAc "select (end_time_ is null) from act_hi_procinst where business_key_='$NID';" | tr -d '[:space:]')
assert_eq "engine instance is ended too" "$engine_running" "f"

# A task that no longer exists must surface the engine's 404, not a blanket 503.
assert_eq "completed task reports 404, not 503" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES/mgr.txt" "$API/tasks/$MT")" "404"

echo
echo "Authorization"
assert_eq "employee cannot read all records" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES/emp.txt" "$API/identity/groups")" "403"
assert_eq "supervisor can read all records" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES/mgr.txt" "$API/identity/groups")" "200"

echo
if [ "$failures" -eq 0 ]; then
  echo "End-to-end workflow test PASSED."
else
  echo "End-to-end workflow test FAILED ($failures assertion(s))."
  exit 1
fi
