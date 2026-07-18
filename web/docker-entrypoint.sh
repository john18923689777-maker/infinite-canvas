#!/bin/sh
set -e

# 由 nginx 官方镜像的入口在启动前自动执行（/docker-entrypoint.d/*.sh），随后 nginx 正常拉起。
# 从环境变量生成运行期配置 config.js；每家统计一个独立变量，未设置的留空，
# 前端据此判定该家「关闭」，不加载对应脚本、不发外部请求。可同时启用多家。

# GA4 / 百度 ID 只含字母、数字和连字符；过滤掉其它字符，
# 避免值里的引号等破坏 config.js 的 JS 字符串（纵深防御）。
sanitize_id() {
    printf '%s' "$1" | tr -cd 'A-Za-z0-9-'
}

sanitize_bool() {
    [ "$1" = "true" ] && printf 'true' || printf 'false'
}

sanitize_text() {
    printf '%s' "$1" | tr -cd 'A-Za-z0-9._:/-'
}

GA4_ID=$(sanitize_id "${ANALYTICS_GA4_ID:-}")
BAIDU_ID=$(sanitize_id "${ANALYTICS_BAIDU_ID:-}")
CUSTOMER_MODE=$(sanitize_bool "${CUSTOMER_MODE:-}")
SOURCE_COMMIT=$(sanitize_text "${SOURCE_COMMIT:-unknown}")
SOURCE_URL=$(sanitize_text "${SOURCE_URL:-}")
IMAGE_TAG=$(sanitize_text "${IMAGE_TAG:-unknown}")
BUILD_TIMESTAMP=$(sanitize_text "${BUILD_TIMESTAMP:-unknown}")

cat > /usr/share/nginx/html/config.js <<EOF
window.__RUNTIME_CONFIG__ = {
  CUSTOMER_MODE: ${CUSTOMER_MODE},
  ANALYTICS_GA4_ID: "${GA4_ID}",
  ANALYTICS_BAIDU_ID: "${BAIDU_ID}"
};
EOF

cat > /usr/share/nginx/html/build-info.json <<EOF
{
  "source_commit": "${SOURCE_COMMIT}",
  "source_url": "${SOURCE_URL}",
  "image_tag": "${IMAGE_TAG}",
  "build_timestamp": "${BUILD_TIMESTAMP}"
}
EOF
