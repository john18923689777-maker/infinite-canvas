#!/bin/sh
set -eu

: "${CANVAS_A_URL:?set CANVAS_A_URL}"
: "${CANVAS_B_URL:?set CANVAS_B_URL}"
: "${STAGING_KEY_A:?set STAGING_KEY_A}"
: "${STAGING_KEY_B:?set STAGING_KEY_B}"
: "${NANO_BANANA_MODEL:?set NANO_BANANA_MODEL}"
: "${REFERENCE_IMAGE:?set REFERENCE_IMAGE to a PNG/JPEG fixture}"
: "${MASK_IMAGE:?set MASK_IMAGE to a same-size PNG mask}"
: "${SNAPSHOT_DIR:?set SNAPSHOT_DIR}"

for command in curl jq base64; do
  command -v "$command" >/dev/null || { echo "FAIL missing command: $command" >&2; exit 1; }
done
[ -s "$REFERENCE_IMAGE" ] || { echo "FAIL REFERENCE_IMAGE is empty" >&2; exit 1; }
[ -s "$MASK_IMAGE" ] || { echo "FAIL MASK_IMAGE is empty" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM
mkdir -p "$SNAPSHOT_DIR"
rm -f "$SNAPSHOT_DIR/after-generation.marker"

request() {
  output=$1
  shift
  status=$(curl -sS --max-time 900 -o "$output" -w '%{http_code}' "$@")
  case "$status" in
    2??) ;;
    *) echo "FAIL HTTP $status for $output" >&2; exit 1 ;;
  esac
}

decode_base64() {
  if printf '%s' "$1" | base64 -d >"$2" 2>/dev/null; then return; fi
  printf '%s' "$1" | base64 -D >"$2"
}

assert_openai_image() {
  file=$1
  encoded=$(jq -er '.data | map(.b64_json // empty) | map(select(length > 64)) | first' "$file") || {
    echo "FAIL OpenAI response has no non-empty b64_json image" >&2
    exit 1
  }
  decode_base64 "$encoded" "$tmp/openai-image.bin"
  [ -s "$tmp/openai-image.bin" ] || { echo "FAIL decoded OpenAI image is empty" >&2; exit 1; }
}

assert_gemini_image() {
  file=$1
  encoded=$(jq -er '[.. | objects | (.inlineData? // .inline_data? // empty) | .data? // empty] | map(select(length > 64)) | first' "$file") || {
    echo "FAIL Gemini response has no non-empty inlineData image" >&2
    exit 1
  }
  decode_base64 "$encoded" "$tmp/gemini-image.bin"
  [ -s "$tmp/gemini-image.bin" ] || { echo "FAIL decoded Gemini image is empty" >&2; exit 1; }
}

assert_expected_error() {
  label=$1
  expected=$2
  output=$3
  shift 3
  status=$(curl -sS --max-time 120 -o "$output" -w '%{http_code}' "$@")
  case ",$expected," in
    *",$status,"*) ;;
    *) echo "FAIL $label returned $status, expected one of $expected" >&2; exit 1 ;;
  esac
  jq -e 'type == "object" and ((.error? != null) or (.message? != null))' "$output" >/dev/null || {
    echo "FAIL $label did not return a structured error" >&2
    exit 1
  }
  echo "PASS $label status=$status"
}

request "$tmp/openai-models.json" -H "Authorization: Bearer $STAGING_KEY_A" "$CANVAS_A_URL/v1/models"
jq -e '(.data? // .models? // []) | length > 0' "$tmp/openai-models.json" >/dev/null
echo "PASS OpenAI model discovery"

request "$tmp/openai-generate.json" -H "Authorization: Bearer $STAGING_KEY_A" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-image-2","prompt":"canvas-storage-probe text generation","n":1,"response_format":"b64_json"}' \
  "$CANVAS_A_URL/v1/images/generations"
assert_openai_image "$tmp/openai-generate.json"
echo "PASS OpenAI gpt-image-2 generation"

request "$tmp/openai-reference.json" -H "Authorization: Bearer $STAGING_KEY_A" \
  -F model=gpt-image-2 -F prompt='canvas-storage-probe reference edit' -F "image=@$REFERENCE_IMAGE" \
  "$CANVAS_A_URL/v1/images/edits"
assert_openai_image "$tmp/openai-reference.json"
echo "PASS OpenAI reference edit"

request "$tmp/openai-mask.json" -H "Authorization: Bearer $STAGING_KEY_A" \
  -F model=gpt-image-2 -F prompt='canvas-storage-probe mask edit' -F "image=@$REFERENCE_IMAGE" -F "mask=@$MASK_IMAGE;type=image/png" \
  "$CANVAS_A_URL/v1/images/edits"
assert_openai_image "$tmp/openai-mask.json"
echo "PASS OpenAI mask edit"

request "$tmp/gemini-models.json" -H "x-goog-api-key: $STAGING_KEY_B" "$CANVAS_B_URL/v1beta/models"
jq -e '(.models? // .data? // []) | length > 0' "$tmp/gemini-models.json" >/dev/null
echo "PASS Gemini model discovery"

request "$tmp/gemini-generate.json" -H "x-goog-api-key: $STAGING_KEY_B" -H 'Content-Type: application/json' \
  -d '{"contents":[{"role":"user","parts":[{"text":"canvas-storage-probe Gemini generation"}]}],"generationConfig":{"responseModalities":["IMAGE"]}}' \
  "$CANVAS_B_URL/v1beta/models/$NANO_BANANA_MODEL:generateContent"
assert_gemini_image "$tmp/gemini-generate.json"
echo "PASS Gemini image generation model=$NANO_BANANA_MODEL"

base64 "$REFERENCE_IMAGE" | tr -d '\r\n' >"$tmp/reference.b64"
jq -n --rawfile image "$tmp/reference.b64" '{contents:[{role:"user",parts:[{inlineData:{mimeType:"image/png",data:$image}},{text:"canvas-storage-probe Gemini reference generation"}]}],generationConfig:{responseModalities:["IMAGE"]}}' >"$tmp/gemini-reference-request.json"
request "$tmp/gemini-reference.json" -H "x-goog-api-key: $STAGING_KEY_B" -H 'Content-Type: application/json' \
  --data-binary "@$tmp/gemini-reference-request.json" "$CANVAS_B_URL/v1beta/models/$NANO_BANANA_MODEL:generateContent"
assert_gemini_image "$tmp/gemini-reference.json"
echo "PASS Gemini reference generation"

invalid_key="invalid-canvas-key-$$"
assert_expected_error 'A invalid key' '401,403' "$tmp/error-a-invalid.json" -H "Authorization: Bearer $invalid_key" "$CANVAS_A_URL/v1/models"
assert_expected_error 'B invalid key' '401,403' "$tmp/error-b-invalid.json" -H "x-goog-api-key: $invalid_key" "$CANVAS_B_URL/v1beta/models"

assert_fixture_pair() {
  label=$1 expected=$2 key_a=$3 key_b=$4
  [ -n "$key_a" ] && [ -n "$key_b" ] || { echo "FAIL missing A/B fixture keys for $label" >&2; exit 1; }
  assert_expected_error "A $label" "$expected" "$tmp/error-a-$label.json" \
    -H "Authorization: Bearer $key_a" -H 'Content-Type: application/json' \
    -d '{"model":"gpt-image-2","prompt":"fixture must fail before generation","n":1}' "$CANVAS_A_URL/v1/images/generations"
  assert_expected_error "B $label" "$expected" "$tmp/error-b-$label.json" \
    -H "x-goog-api-key: $key_b" -H 'Content-Type: application/json' \
    -d '{"contents":[{"role":"user","parts":[{"text":"fixture must fail before generation"}]}],"generationConfig":{"responseModalities":["IMAGE"]}}' \
    "$CANVAS_B_URL/v1beta/models/$NANO_BANANA_MODEL:generateContent"
}

assert_fixture_pair wrong-group '400,403' "${FIXTURE_A_WRONG_GROUP_KEY:-}" "${FIXTURE_B_WRONG_GROUP_KEY:-}"
assert_fixture_pair no-image-permission '400,403' "${FIXTURE_A_NO_IMAGE_PERMISSION_KEY:-}" "${FIXTURE_B_NO_IMAGE_PERMISSION_KEY:-}"
assert_fixture_pair empty-balance '400,402,403' "${FIXTURE_A_EMPTY_BALANCE_KEY:-}" "${FIXTURE_B_EMPTY_BALANCE_KEY:-}"
assert_fixture_pair rate-limit '429' "${FIXTURE_A_RATE_LIMIT_KEY:-}" "${FIXTURE_B_RATE_LIMIT_KEY:-}"

: "${FIXTURE_A_UPSTREAM_5XX_ROUTE:?set FIXTURE_A_UPSTREAM_5XX_ROUTE}"
: "${FIXTURE_B_UPSTREAM_5XX_ROUTE:?set FIXTURE_B_UPSTREAM_5XX_ROUTE}"
assert_expected_error 'A upstream unavailable' '500,502,503,504' "$tmp/error-a-upstream.json" -H "Authorization: Bearer $STAGING_KEY_A" "$CANVAS_A_URL$FIXTURE_A_UPSTREAM_5XX_ROUTE"
assert_expected_error 'B upstream unavailable' '500,502,503,504' "$tmp/error-b-upstream.json" -H "x-goog-api-key: $STAGING_KEY_B" "$CANVAS_B_URL$FIXTURE_B_UPSTREAM_5XX_ROUTE"

touch "$SNAPSHOT_DIR/after-generation.marker"
echo "PASS errors isolated"
echo "PASS image acceptance"
