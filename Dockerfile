# 构建 Vite 前端产物。
FROM oven/bun:1.3.13 AS web-build

ARG VITE_CUSTOMER_MODE=true
ARG SOURCE_COMMIT=unknown
ARG SOURCE_URL=
ARG IMAGE_TAG=unknown
ARG BUILD_TIMESTAMP=unknown
ENV VITE_CUSTOMER_MODE=${VITE_CUSTOMER_MODE}
ENV SOURCE_COMMIT=${SOURCE_COMMIT}
ENV SOURCE_URL=${SOURCE_URL}
ENV IMAGE_TAG=${IMAGE_TAG}
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

WORKDIR /app/web
COPY web/package.json web/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --cache-dir=/root/.bun/install/cache
COPY VERSION /app/VERSION
COPY CHANGELOG.md /app/CHANGELOG.md
COPY web ./
RUN bun run build

# 运行镜像：只启动静态前端，AI 请求由浏览器前台直连用户自己的接口。
FROM nginx:1.27-alpine

COPY --from=web-build /app/web/dist /usr/share/nginx/html
ARG SOURCE_COMMIT=unknown
ARG SOURCE_URL=
ARG IMAGE_TAG=unknown
ARG BUILD_TIMESTAMP=unknown
ENV SOURCE_COMMIT=${SOURCE_COMMIT}
ENV SOURCE_URL=${SOURCE_URL}
ENV IMAGE_TAG=${IMAGE_TAG}
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY web/docker-entrypoint.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 3000
