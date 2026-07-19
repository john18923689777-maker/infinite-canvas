#!/bin/sh
set -eu

: "${COMPOSE_PROJECT_A:?set COMPOSE_PROJECT_A}"
: "${COMPOSE_PROJECT_B:?set COMPOSE_PROJECT_B}"
: "${SNAPSHOT_DIR:?set SNAPSHOT_DIR}"
: "${CANVAS_LOG_A:?set CANVAS_LOG_A to the 55ai canvas access log}"
: "${CANVAS_LOG_B:?set CANVAS_LOG_B to the ai16888 canvas access log}"

WAIT_SECONDS=${WAIT_SECONDS:-1800}

resolve_container() {
  project=$1
  explicit=$2
  if [ -n "$explicit" ]; then
    docker inspect "$explicit" >/dev/null
    printf '%s\n' "$explicit"
    return
  fi

  names=$(docker ps --filter "label=com.docker.compose.project=$project" --format '{{.Names}}')
  if [ -z "$names" ] && docker inspect "$project" >/dev/null 2>&1; then
    names=$project
  fi
  count=$(printf '%s\n' "$names" | sed '/^$/d' | wc -l | tr -d ' ')
  [ "$count" -eq 1 ] || {
    echo "FAIL expected exactly one container for $project, found $count" >&2
    exit 1
  }
  printf '%s\n' "$names"
}

snapshot_instance() {
  phase=$1
  label=$2
  container=$3
  destination="$SNAPSHOT_DIR/$phase/$label"
  mkdir -p "$destination"

  docker inspect "$container" >"$destination/inspect.json"
  docker inspect --format '{{.Id}}' "$container" >"$destination/container-id.txt"
  docker inspect --format '{{.Image}}' "$container" >"$destination/image-id.txt"
  docker inspect --format '{{json .Mounts}}' "$container" >"$destination/mounts.json"
  docker diff "$container" | LC_ALL=C sort >"$destination/docker-diff.txt"
  docker logs "$container" >"$destination/container.log" 2>&1 || true

  mounts=$(tr -d '[:space:]' <"$destination/mounts.json")
  [ "$mounts" = '[]' ] || {
    echo "FAIL $label has server-side mounts" >&2
    exit 1
  }
}

scan_log() {
  label=$1
  path=$2
  [ -f "$path" ] || {
    echo "FAIL $label log is not readable: $path" >&2
    exit 1
  }

  for secret in "${STAGING_KEY_A:-}" "${STAGING_KEY_B:-}"; do
    [ -z "$secret" ] || ! grep -Fq "$secret" "$path" || {
      echo "FAIL $label log contains a staging API key" >&2
      exit 1
    }
  done
  if grep -Eiq '(authorization[[:space:]:=]|x-goog-api-key[[:space:]:=]|"b64_json"|"inlineData"|"inline_data"|canvas-storage-probe)' "$path"; then
    echo "FAIL $label log contains credentials or image request/response data" >&2
    exit 1
  fi
}

container_a=$(resolve_container "$COMPOSE_PROJECT_A" "${CONTAINER_A:-}")
container_b=$(resolve_container "$COMPOSE_PROJECT_B" "${CONTAINER_B:-}")
[ "$container_a" != "$container_b" ] || {
  echo "FAIL both instances resolved to the same container" >&2
  exit 1
}

rm -rf "$SNAPSHOT_DIR/before-generation" "$SNAPSHOT_DIR/after-generation"
snapshot_instance before-generation 55ai "$container_a"
snapshot_instance before-generation ai16888 "$container_b"

elapsed=0
while [ ! -f "$SNAPSHOT_DIR/after-generation.marker" ]; do
  [ "$elapsed" -lt "$WAIT_SECONDS" ] || {
    echo "FAIL timed out waiting for after-generation.marker" >&2
    exit 1
  }
  sleep 2
  elapsed=$((elapsed + 2))
done

snapshot_instance after-generation 55ai "$container_a"
snapshot_instance after-generation ai16888 "$container_b"

for label in 55ai ai16888; do
  before="$SNAPSHOT_DIR/before-generation/$label"
  after="$SNAPSHOT_DIR/after-generation/$label"
  cmp -s "$before/container-id.txt" "$after/container-id.txt" || {
    echo "FAIL $label container changed during storage scan" >&2
    exit 1
  }
  comm -13 "$before/docker-diff.txt" "$after/docker-diff.txt" >"$after/docker-diff.delta.txt"
  if grep -Eiq '(image_files|media_files|canvas-assets|user_data|/\.data|\.(png|jpe?g|webp|gif|avif|heic|bmp|tiff?|mp4|mov|webm|m4a|mp3|wav)([[:space:]]|$))' "$after/docker-diff.delta.txt"; then
    echo "FAIL $label wrote a customer media artifact into the container" >&2
    exit 1
  fi
  scan_log "$label container" "$after/container.log"
done

scan_log '55ai access' "$CANVAS_LOG_A"
scan_log 'ai16888 access' "$CANVAS_LOG_B"
echo "PASS no server-side customer assets"
