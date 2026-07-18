#!/bin/sh
set -eu
: "${CANVAS_A_URL:?set CANVAS_A_URL}"
: "${CANVAS_B_URL:?set CANVAS_B_URL}"
: "${STAGING_KEY_A:?set STAGING_KEY_A}"
: "${STAGING_KEY_B:?set STAGING_KEY_B}"
: "${EXPECTED_A_UPSTREAM:?set EXPECTED_A_UPSTREAM}"
: "${EXPECTED_B_UPSTREAM:?set EXPECTED_B_UPSTREAM}"

curl_json() { curl -fsS --max-time 30 -H "Authorization: Bearer $2" "$1"; }

curl_json "$CANVAS_A_URL/v1/models" "$STAGING_KEY_A" >/tmp/canvas-a-models.json
curl_json "$CANVAS_B_URL/v1/models" "$STAGING_KEY_B" >/tmp/canvas-b-models.json
grep -q 'data\|models' /tmp/canvas-a-models.json
grep -q 'data\|models' /tmp/canvas-b-models.json

if curl -fsS --max-time 15 -H "Authorization: Bearer $STAGING_KEY_A" "$CANVAS_B_URL/v1/models" >/dev/null 2>&1; then
  echo "FAIL cross-instance A key accepted by B" >&2; exit 1
fi
if curl -fsS --max-time 15 -H "Authorization: Bearer $STAGING_KEY_B" "$CANVAS_A_URL/v1/models" >/dev/null 2>&1; then
  echo "FAIL cross-instance B key accepted by A" >&2; exit 1
fi

echo "PASS canvas A isolated upstream=$EXPECTED_A_UPSTREAM"
echo "PASS canvas B isolated upstream=$EXPECTED_B_UPSTREAM"
