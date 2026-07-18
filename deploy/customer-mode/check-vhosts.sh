#!/bin/sh
set -eu
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
check() {
  file=$1 host=$2 upstream=$3 port=$4 parent=$5
  for needle in "server_name $host" "proxy_pass https://$upstream" "proxy_ssl_server_name on" "proxy_ssl_name $upstream" "proxy_set_header Host $upstream" "location /v1/" "location /v1beta/" "proxy_pass_request_headers off" 'proxy_set_header Authorization $http_authorization' 'proxy_set_header x-goog-api-key $http_x_goog_api_key' 'proxy_set_header Content-Type $http_content_type' 'proxy_set_header Content-Length $http_content_length' 'proxy_set_header Accept $http_accept' 'proxy_set_header Cookie ""' 'proxy_set_header X-API-Key ""' 'proxy_request_buffering off' 'proxy_buffering off' 'client_max_body_size 268435456' 'proxy_read_timeout 900s' "proxy_pass http://127.0.0.1:$port" "frame-ancestors $parent"; do
    grep -F "$needle" "$DIR/$file" >/dev/null || { echo "FAIL $file: $needle" >&2; exit 1; }
  done
  grep -F 'log_format canvas_redacted' "$DIR/$file" >/dev/null
  ! grep -Eq '\$(request|request_uri|request_line|args|query_string)' "$DIR/$file"
  echo "PASS $file"
}
check canvas-55ai.conf canvas.55ai.xyz 55ai.xyz 3311 https://55ai.xyz
check canvas-ai16888.conf canvas.ai16888.com.cn sub2.ai16888.com.cn 3312 https://sub2.ai16888.com.cn
