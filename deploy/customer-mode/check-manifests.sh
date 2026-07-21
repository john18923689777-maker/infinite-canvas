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

check_file compose-55ai.yml infinite-canvas-55ai 3311 55ai.env infinite-canvas-sub2-customer:55ai-79c8d64
check_file compose-ai16888.yml infinite-canvas-ai16888 3312 ai16888.env infinite-canvas-sub2-customer:ai16888-b2527b9
source_url_55ai=https://github.com/john18923689777-maker/infinite-canvas/commit/79c8d64
source_url_ai16888=https://github.com/john18923689777-maker/infinite-canvas/commit/b2527b9
build_timestamp_55ai=2026-07-21T08:57:56Z
build_timestamp_ai16888=2026-07-20T04:47:19Z
check_env 55ai.env 55ai infinite-canvas-sub2-customer:55ai-79c8d64 "$source_url_55ai" "$build_timestamp_55ai"
check_env ai16888.env ai16888 infinite-canvas-sub2-customer:ai16888-b2527b9 "$source_url_ai16888" "$build_timestamp_ai16888"
check_provenance provenance-55ai.json 55ai canvas.55ai.xyz infinite-canvas-sub2-customer:55ai-79c8d64 sha256:f34c8c9e4a27b00327d611a8349ab203eb07084ff599a9e8e55b1730b7fb068b 79c8d64 "$source_url_55ai" ac383eb "$build_timestamp_55ai"
check_provenance provenance-ai16888.json ai16888 sub.ai16888.com.cn infinite-canvas-sub2-customer:ai16888-b2527b9 sha256:f8bf8993c8c377d3d51cad0225c109b909bab83770687ef76cd4399bcabb5679 b2527b9 "$source_url_ai16888" ac383eb "$build_timestamp_ai16888"
cmp -s "$DIR/env/55ai.env" "$DIR/env/ai16888.env" && { echo "FAIL env files must differ" >&2; exit 1; } || true
