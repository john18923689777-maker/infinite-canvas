#!/bin/sh
set -eu
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
check() {
  file=$1 host=$2 upstream=$3 port=$4 parent=$5
  log_file="/var/log/nginx/${file%.conf}.access.log"
  for needle in "listen 80" "server_name $host" "return 301 https://$host\$request_uri" "listen 443 ssl http2" "ssl_certificate /etc/letsencrypt/live/$host/fullchain.pem" "ssl_certificate_key /etc/letsencrypt/live/$host/privkey.pem" "access_log $log_file canvas_redacted" "proxy_pass https://$upstream" "proxy_ssl_server_name on" "proxy_ssl_name $upstream" "proxy_set_header Host $upstream" "location /v1/" "location /v1beta/" "proxy_pass_request_headers off" 'proxy_set_header Authorization $http_authorization' 'proxy_set_header x-goog-api-key $http_x_goog_api_key' 'proxy_set_header X-Request-ID $http_x_request_id' 'proxy_set_header Content-Type $http_content_type' 'proxy_set_header Content-Length $http_content_length' 'proxy_set_header Accept $http_accept' 'proxy_set_header Cookie ""' 'proxy_set_header X-API-Key ""' 'proxy_request_buffering off' 'proxy_buffering off' 'client_max_body_size 268435456' 'proxy_read_timeout 900s' "proxy_pass http://127.0.0.1:$port" "frame-ancestors $parent"; do
    grep -F "$needle" "$DIR/$file" >/dev/null || { echo "FAIL $file: $needle" >&2; exit 1; }
  done
  grep -F 'log_format canvas_redacted' "$DIR/logformat-canvas.conf" >/dev/null
  test "$(grep -Fc "access_log $log_file canvas_redacted" "$DIR/$file")" -eq 1 || {
    echo "FAIL $file: redacted access_log must be declared exactly once at server scope" >&2
    exit 1
  }
  first_location=$(grep -n '^[[:space:]]*location ' "$DIR/$file" | sed -n '1s/:.*//p')
  access_line=$(grep -nF "access_log $log_file canvas_redacted" "$DIR/$file" | sed -n '1s/:.*//p')
  test -n "$first_location" && test -n "$access_line" && test "$access_line" -lt "$first_location" || {
    echo "FAIL $file: redacted access_log must apply to every location" >&2
    exit 1
  }
  ! grep -Eq '\$(request|request_uri|request_line|args|query_string)' "$DIR/$file"
  echo "PASS $file"
}
check canvas-55ai.conf canvas.55ai.xyz 55ai.xyz 3311 https://55ai.xyz
check canvas-ai16888.conf canvas.ai16888.com.cn sub2.ai16888.com.cn 3312 https://sub2.ai16888.com.cn
