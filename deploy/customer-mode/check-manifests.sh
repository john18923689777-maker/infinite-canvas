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
  file=$1 instance=$2 image=$3
  grep -Fx 'CUSTOMER_MODE=true' "$DIR/env/$file" >/dev/null
  grep -Fx "CANVAS_INSTANCE=$instance" "$DIR/env/$file" >/dev/null
  grep -Fx "IMAGE_TAG=$image" "$DIR/env/$file" >/dev/null
  ! grep -Eiq '(api[_-]?key|authorization|password|secret|token)\s*=' "$DIR/env/$file"
}

check_file compose-55ai.yml infinite-canvas-55ai 3311 55ai.env infinite-canvas-sub2-customer:55ai-ee351ee
check_file compose-ai16888.yml infinite-canvas-ai16888 3312 ai16888.env infinite-canvas-sub2-customer:ai16888-ee351ee
check_env 55ai.env 55ai infinite-canvas-sub2-customer:55ai-ee351ee
check_env ai16888.env ai16888 infinite-canvas-sub2-customer:ai16888-ee351ee
cmp -s "$DIR/env/55ai.env" "$DIR/env/ai16888.env" && { echo "FAIL env files must differ" >&2; exit 1; } || true
