#!/bin/sh
set -eu

: "${CANVAS_A_URL:?set CANVAS_A_URL}"
: "${CANVAS_B_URL:?set CANVAS_B_URL}"
: "${PARENT_A_URL:?set PARENT_A_URL}"
: "${PARENT_B_URL:?set PARENT_B_URL}"
: "${STAGING_KEY_A:?set STAGING_KEY_A}"
: "${STAGING_KEY_B:?set STAGING_KEY_B}"
: "${NANO_BANANA_MODEL:?set NANO_BANANA_MODEL}"
: "${EXPECTED_A_UPSTREAM:?set EXPECTED_A_UPSTREAM}"
: "${EXPECTED_B_UPSTREAM:?set EXPECTED_B_UPSTREAM}"

[ "$EXPECTED_A_UPSTREAM" = "55ai.xyz" ] || { echo "FAIL unexpected A upstream contract" >&2; exit 1; }
[ "$EXPECTED_B_UPSTREAM" = "sub2.ai16888.com.cn" ] || { echo "FAIL unexpected B upstream contract" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM
stamp=$(date +%s)
trace_a="X-Canvas-Acceptance-Trace-a-$stamp-$$"
trace_b="X-Canvas-Acceptance-Trace-b-$stamp-$$"
trace_a_image="X-Canvas-Acceptance-Trace-ai-$stamp-$$"
trace_b_image="X-Canvas-Acceptance-Trace-bi-$stamp-$$"

status_for() {
  output=$1
  shift
  curl -sS --max-time 180 -o "$output" -w '%{http_code}' "$@"
}

assert_success() {
  label=$1
  status=$2
  case "$status" in 2??) ;; *) echo "FAIL $label status=$status" >&2; exit 1 ;; esac
}

status=$(status_for "$tmp/a-models.json" -H "X-Request-ID: $trace_a" -H "Authorization: Bearer $STAGING_KEY_A" "$CANVAS_A_URL/v1/models?upstream=$EXPECTED_B_UPSTREAM")
assert_success 'A model route' "$status"
status=$(status_for "$tmp/b-models.json" -H "X-Request-ID: $trace_b" -H "x-goog-api-key: $STAGING_KEY_B" "$CANVAS_B_URL/v1beta/models?upstream=$EXPECTED_A_UPSTREAM")
assert_success 'B model route' "$status"

# Deliberately invalid image payloads exercise each image route without paying for a generation.
status_for "$tmp/a-image.json" -H "X-Request-ID: $trace_a_image" -H "Authorization: Bearer $STAGING_KEY_A" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-image-2"}' "$CANVAS_A_URL/v1/images/generations" >/dev/null
status_for "$tmp/b-image.json" -H "X-Request-ID: $trace_b_image" -H "x-goog-api-key: $STAGING_KEY_B" -H 'Content-Type: application/json' \
  -d '{"contents":[]}' "$CANVAS_B_URL/v1beta/models/$NANO_BANANA_MODEL:generateContent" >/dev/null

cross=$(status_for "$tmp/cross-a-to-b.json" -H "Authorization: Bearer $STAGING_KEY_A" "$CANVAS_B_URL/v1/models")
case "$cross" in 401|403) ;; *) echo "FAIL A key was not rejected by B: $cross" >&2; exit 1 ;; esac
cross=$(status_for "$tmp/cross-b-to-a.json" -H "x-goog-api-key: $STAGING_KEY_B" "$CANVAS_A_URL/v1beta/models")
case "$cross" in 401|403) ;; *) echo "FAIL B key was not rejected by A: $cross" >&2; exit 1 ;; esac

capture_trace_logs() {
  if [ -n "${SUB2_CONTAINER_A:-}" ] && [ -n "${SUB2_CONTAINER_B:-}" ]; then
    docker logs --since 10m "$SUB2_CONTAINER_A" >"$tmp/sub2-a.log" 2>&1
    docker logs --since 10m "$SUB2_CONTAINER_B" >"$tmp/sub2-b.log" 2>&1
    TRACE_LOG_A="$tmp/sub2-a.log"
    TRACE_LOG_B="$tmp/sub2-b.log"
    export TRACE_LOG_A TRACE_LOG_B
  fi
  : "${TRACE_LOG_A:?set TRACE_LOG_A or SUB2_CONTAINER_A}"
  : "${TRACE_LOG_B:?set TRACE_LOG_B or SUB2_CONTAINER_B}"
  [ -f "$TRACE_LOG_A" ] && [ -f "$TRACE_LOG_B" ] || { echo "FAIL trace logs are unreadable" >&2; exit 1; }
}

assert_trace_isolated() {
  trace=$1
  expected_log=$2
  other_log=$3
  grep -F "$trace" "$expected_log" >/dev/null || { echo "FAIL matching Sub2 trace not found" >&2; exit 1; }
  ! grep -F "$trace" "$other_log" >/dev/null || { echo "FAIL trace crossed into the other Sub2 instance" >&2; exit 1; }
}

capture_trace_logs
assert_trace_isolated "$trace_a" "$TRACE_LOG_A" "$TRACE_LOG_B"
assert_trace_isolated "$trace_a_image" "$TRACE_LOG_A" "$TRACE_LOG_B"
assert_trace_isolated "$trace_b" "$TRACE_LOG_B" "$TRACE_LOG_A"
assert_trace_isolated "$trace_b_image" "$TRACE_LOG_B" "$TRACE_LOG_A"

curl -sS --max-time 30 -D "$tmp/canvas-a.headers" -o /dev/null "$CANVAS_A_URL/"
curl -sS --max-time 30 -D "$tmp/canvas-b.headers" -o /dev/null "$CANVAS_B_URL/"
curl -sS --max-time 30 -D "$tmp/parent-a.headers" -o /dev/null "$PARENT_A_URL/"
curl -sS --max-time 30 -D "$tmp/parent-b.headers" -o /dev/null "$PARENT_B_URL/"

grep -Eiq "^content-security-policy:.*frame-ancestors[[:space:]]+https://55ai\.xyz([;'[:space:]]|$)" "$tmp/canvas-a.headers" || { echo "FAIL A frame-ancestors" >&2; exit 1; }
grep -Eiq "^content-security-policy:.*frame-ancestors[[:space:]]+https://sub2\.ai16888\.com\.cn([;'[:space:]]|$)" "$tmp/canvas-b.headers" || { echo "FAIL B frame-ancestors" >&2; exit 1; }
! grep -Eiq '^x-frame-options:' "$tmp/canvas-a.headers" || { echo "FAIL A X-Frame-Options conflicts with CSP" >&2; exit 1; }
! grep -Eiq '^x-frame-options:' "$tmp/canvas-b.headers" || { echo "FAIL B X-Frame-Options conflicts with CSP" >&2; exit 1; }
grep -Eiq '^content-security-policy:.*frame-src[^;]*https://canvas\.55ai\.xyz' "$tmp/parent-a.headers" || { echo "FAIL parent A frame-src" >&2; exit 1; }
grep -Eiq '^content-security-policy:.*frame-src[^;]*https://canvas\.ai16888\.com\.cn' "$tmp/parent-b.headers" || { echo "FAIL parent B frame-src" >&2; exit 1; }
! grep -Eiq '^content-security-policy:.*frame-src[^;]*https://canvas\.ai16888\.com\.cn' "$tmp/parent-a.headers" || { echo "FAIL parent A allows canvas B" >&2; exit 1; }
! grep -Eiq '^content-security-policy:.*frame-src[^;]*https://canvas\.55ai\.xyz' "$tmp/parent-b.headers" || { echo "FAIL parent B allows canvas A" >&2; exit 1; }

echo "PASS canvas A isolated upstream=$EXPECTED_A_UPSTREAM"
echo "PASS canvas B isolated upstream=$EXPECTED_B_UPSTREAM"
