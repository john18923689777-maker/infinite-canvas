#!/bin/sh
set -eu
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

check_file() {
  file=$1 service=$2 port=$3 env_file=$4 image=$5
  grep -F "${service}:" "$DIR/$file" >/dev/null
  grep -F "container_name: $service" "$DIR/$file" >/dev/null
  grep -F "127.0.0.1:$port:3000" "$DIR/$file" >/dev/null
  grep -F "restart: unless-stopped" "$DIR/$file" >/dev/null
  grep -F "./env/$env_file" "$DIR/$file" >/dev/null
  grep -F "image: $image" "$DIR/$file" >/dev/null
  grep -F "max-size: 50m" "$DIR/$file" >/dev/null
  grep -F 'max-file: "10"' "$DIR/$file" >/dev/null
  ! grep -Eiq '(volumes:|image_files|media_files|canvas-assets|\.data|user_data)' "$DIR/$file"
  echo "PASS $file"
}

check_env() {
  file=$1 instance=$2 image=$3 source_url=$4 build_timestamp=$5
  grep -Fx 'CUSTOMER_MODE=true' "$DIR/env/$file" >/dev/null
  grep -Fx "CANVAS_INSTANCE=$instance" "$DIR/env/$file" >/dev/null
  grep -Fx "IMAGE_TAG=$image" "$DIR/env/$file" >/dev/null
  grep -Fx "SOURCE_URL=$source_url" "$DIR/env/$file" >/dev/null
  grep -Fx "BUILD_TIMESTAMP=$build_timestamp" "$DIR/env/$file" >/dev/null
  ! grep -Eiq '(api[_-]?key|authorization|password|secret|token)\s*=' "$DIR/env/$file"
}

check_provenance() {
  file=$1 instance=$2 domain=$3 image=$4 digest=$5 source_commit=$6 source_url=$7 proxy_revision=$8 build_timestamp=$9
  jq -e \
    --arg instance "$instance" \
    --arg domain "$domain" \
    --arg image "$image" \
    --arg digest "$digest" \
    --arg source_commit "$source_commit" \
    --arg source_url "$source_url" \
    --arg proxy_revision "$proxy_revision" \
    --arg build_timestamp "$build_timestamp" \
    '.instance == $instance and .domain == $domain and .image_tag == $image and .image_digest == $digest and .source_commit == $source_commit and .source_url == $source_url and .proxy_revision == $proxy_revision and .image_build_timestamp == $build_timestamp' \
    "$DIR/$file" >/dev/null || { echo "FAIL $file provenance mismatch" >&2; exit 1; }
}

check_file compose-55ai.yml infinite-canvas-55ai 3311 55ai.env infinite-canvas-sub2-customer:55ai-6845289
check_file compose-ai16888.yml infinite-canvas-ai16888 3312 ai16888.env infinite-canvas-sub2-customer:ai16888-8f4f09b
source_url_55ai=https://github.com/john18923689777-maker/infinite-canvas/commit/6845289
source_url_ai16888=https://github.com/john18923689777-maker/infinite-canvas/commit/8f4f09b
build_timestamp_55ai=2026-07-20T04:03:07Z
build_timestamp_ai16888=2026-07-19T04:33:53Z
check_env 55ai.env 55ai infinite-canvas-sub2-customer:55ai-6845289 "$source_url_55ai" "$build_timestamp_55ai"
check_env ai16888.env ai16888 infinite-canvas-sub2-customer:ai16888-8f4f09b "$source_url_ai16888" "$build_timestamp_ai16888"
check_provenance provenance-55ai.json 55ai canvas.55ai.xyz infinite-canvas-sub2-customer:55ai-6845289 sha256:bb788bd6871d32bcdd7361973946f6108d19dcd3c4997a887ce7654d7f77ca96 6845289 "$source_url_55ai" ac383eb "$build_timestamp_55ai"
check_provenance provenance-ai16888.json ai16888 canvas.ai16888.com.cn infinite-canvas-sub2-customer:ai16888-8f4f09b sha256:03b284dcba12dd1719f55788802001a3f401a224c10edb12441ef40cdbf91ce1 8f4f09b "$source_url_ai16888" ac383eb "$build_timestamp_ai16888"
cmp -s "$DIR/env/55ai.env" "$DIR/env/ai16888.env" && { echo "FAIL env files must differ" >&2; exit 1; } || true
