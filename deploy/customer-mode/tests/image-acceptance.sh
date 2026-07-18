#!/bin/sh
set -eu
: "${CANVAS_A_URL:?set CANVAS_A_URL}"
: "${CANVAS_B_URL:?set CANVAS_B_URL}"
: "${STAGING_KEY_A:?set STAGING_KEY_A}"
: "${STAGING_KEY_B:?set STAGING_KEY_B}"
: "${NANO_BANANA_MODEL:?set NANO_BANANA_MODEL}"
: "${SNAPSHOT_DIR:?set SNAPSHOT_DIR}"

mkdir -p "$SNAPSHOT_DIR"
curl -fsS --max-time 30 -H "Authorization: Bearer $STAGING_KEY_A" "$CANVAS_A_URL/v1/models" >/dev/null
echo "PASS OpenAI model discovery"
curl -fsS --max-time 180 -H "Authorization: Bearer $STAGING_KEY_A" -H 'Content-Type: application/json' \
  -d '{"model":"gpt-image-2","prompt":"staging acceptance test","n":1,"response_format":"b64_json"}' \
  "$CANVAS_A_URL/v1/images/generations" >/dev/null
echo "PASS OpenAI gpt-image-2 generation"

curl -fsS --max-time 30 -H "x-goog-api-key: $STAGING_KEY_B" "$CANVAS_B_URL/v1beta/models" >/dev/null
echo "PASS Gemini model discovery"
curl -fsS --max-time 180 -H "x-goog-api-key: $STAGING_KEY_B" -H 'Content-Type: application/json' \
  -d "{\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":\"staging acceptance test\"}]}],\"generationConfig\":{\"responseModalities\":[\"IMAGE\"]}}" \
  "$CANVAS_B_URL/v1beta/models/$NANO_BANANA_MODEL:generateContent" >/dev/null
echo "PASS Gemini image generation model=$NANO_BANANA_MODEL"

touch "$SNAPSHOT_DIR/after-generation.marker"
echo "PASS image acceptance"
