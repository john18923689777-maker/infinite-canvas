#!/bin/sh
set -eu
: "${COMPOSE_PROJECT_A:?set COMPOSE_PROJECT_A}"
: "${COMPOSE_PROJECT_B:?set COMPOSE_PROJECT_B}"
: "${SNAPSHOT_DIR:?set SNAPSHOT_DIR}"

mkdir -p "$SNAPSHOT_DIR"
before="$SNAPSHOT_DIR/before-generation"
after="$SNAPSHOT_DIR/after-generation"
mkdir -p "$before" "$after"
docker ps --filter "name=$COMPOSE_PROJECT_A" --format '{{.Names}}' >"$before/containers-a.txt"
docker ps --filter "name=$COMPOSE_PROJECT_B" --format '{{.Names}}' >"$before/containers-b.txt"
docker inspect $(docker ps -q --filter "name=$COMPOSE_PROJECT_A" --filter "name=$COMPOSE_PROJECT_B") \
  --format '{{.Name}} {{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}' >"$before/mounts.txt" || true

while [ ! -f "$SNAPSHOT_DIR/after-generation.marker" ]; do sleep 2; done
cp "$before"/* "$after"/ 2>/dev/null || true
if grep -Eiq '(image_files|media_files|canvas-assets|user_data|\.data)' "$after/mounts.txt"; then
  echo "FAIL server-side customer asset mount detected" >&2; exit 1
fi
echo "PASS no server-side customer assets"
