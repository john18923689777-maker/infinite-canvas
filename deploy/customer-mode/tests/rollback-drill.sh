#!/bin/sh
set -eu

: "${AFFECTED_INSTANCE:?set AFFECTED_INSTANCE to 55ai or ai16888}"
: "${A_SETTINGS_JSON:?set A_SETTINGS_JSON}"
: "${B_SETTINGS_JSON:?set B_SETTINGS_JSON}"
: "${A_COMPOSE_FILE:?set A_COMPOSE_FILE}"
: "${B_COMPOSE_FILE:?set B_COMPOSE_FILE}"
: "${A_VHOST_FILE:?set A_VHOST_FILE}"
: "${B_VHOST_FILE:?set B_VHOST_FILE}"
: "${A_PROVENANCE_FILE:?set A_PROVENANCE_FILE}"
: "${B_PROVENANCE_FILE:?set B_PROVENANCE_FILE}"
: "${A_PREVIOUS_DIR:?set A_PREVIOUS_DIR}"
: "${B_PREVIOUS_DIR:?set B_PREVIOUS_DIR}"
: "${A_SETTINGS_APPLY_SCRIPT:?set A_SETTINGS_APPLY_SCRIPT}"
: "${B_SETTINGS_APPLY_SCRIPT:?set B_SETTINGS_APPLY_SCRIPT}"
: "${A_HEALTH_URL:?set A_HEALTH_URL}"
: "${B_HEALTH_URL:?set B_HEALTH_URL}"
: "${A_CONTAINER:?set A_CONTAINER}"
: "${B_CONTAINER:?set B_CONTAINER}"
: "${A_LOG_DIR:?set A_LOG_DIR}"
: "${B_LOG_DIR:?set B_LOG_DIR}"
: "${SNAPSHOT_DIR:?set SNAPSHOT_DIR}"

for command in docker curl jq cmp; do command -v "$command" >/dev/null || { echo "FAIL missing command: $command" >&2; exit 1; }; done

hash_file() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | awk '{print $1}'; else shasum -a 256 "$1" | awk '{print $1}'; fi
}

tree_manifest() {
  root=$1
  output=$2
  [ -d "$root" ] || { echo "FAIL missing log directory: $root" >&2; exit 1; }
  find "$root" -type f -print | LC_ALL=C sort | while IFS= read -r file; do
    printf '%s  %s\n' "$(hash_file "$file")" "$file"
  done >"$output"
}

instance_manifest() {
  label=$1 settings=$2 compose=$3 vhost=$4 provenance=$5 container=$6 log_dir=$7 destination=$8
  mkdir -p "$destination"
  for file in "$settings" "$compose" "$vhost" "$provenance"; do [ -f "$file" ] || { echo "FAIL $label missing $file" >&2; exit 1; }; done
  for file in "$settings" "$compose" "$vhost" "$provenance"; do printf '%s  %s\n' "$(hash_file "$file")" "$file"; done >"$destination/files.sha256"
  docker inspect --format '{{.Id}} {{.Image}} {{.Name}}' "$container" >"$destination/container.txt"
  tree_manifest "$log_dir" "$destination/logs.sha256"
}

restore_instance() {
  label=$1 previous=$2 settings=$3 compose=$4 vhost=$5 provenance=$6 apply_script=$7 health_url=$8 container=$9
  for file in settings.json compose.yml vhost.conf provenance.json; do [ -f "$previous/$file" ] || { echo "FAIL $label previous bundle lacks $file" >&2; exit 1; }; done
  [ -x "$apply_script" ] || { echo "FAIL $label settings apply script is not executable" >&2; exit 1; }

  "$apply_script" "$previous/settings.json"
  install -m 600 "$previous/settings.json" "$settings"
  install -m 644 "$previous/compose.yml" "$compose"
  install -m 644 "$previous/vhost.conf" "$vhost"
  install -m 644 "$previous/provenance.json" "$provenance"

  sudo -n nginx -t
  sudo -n nginx -s reload
  docker compose -f "$compose" up -d --force-recreate

  expected_image=$(jq -er '.image_tag' "$previous/provenance.json")
  attempts=0
  until curl -fsS --max-time 10 "$health_url" >/dev/null; do
    attempts=$((attempts + 1))
    [ "$attempts" -lt 30 ] || { echo "FAIL $label did not become healthy after rollback" >&2; exit 1; }
    sleep 2
  done
  actual_image=$(docker inspect --format '{{.Config.Image}}' "$container")
  [ "$actual_image" = "$expected_image" ] || { echo "FAIL $label image=$actual_image expected=$expected_image" >&2; exit 1; }
  cmp -s "$previous/settings.json" "$settings"
  cmp -s "$previous/compose.yml" "$compose"
  cmp -s "$previous/vhost.conf" "$vhost"
  cmp -s "$previous/provenance.json" "$provenance"
}

root="$SNAPSHOT_DIR/rollback-$AFFECTED_INSTANCE"
rm -rf "$root"
mkdir -p "$root"
instance_manifest 55ai "$A_SETTINGS_JSON" "$A_COMPOSE_FILE" "$A_VHOST_FILE" "$A_PROVENANCE_FILE" "$A_CONTAINER" "$A_LOG_DIR" "$root/a.before"
instance_manifest ai16888 "$B_SETTINGS_JSON" "$B_COMPOSE_FILE" "$B_VHOST_FILE" "$B_PROVENANCE_FILE" "$B_CONTAINER" "$B_LOG_DIR" "$root/b.before"

case "$AFFECTED_INSTANCE" in
  55ai)
    cp "$root/b.before/files.sha256" "$root/unaffected.before.sha256"
    cat "$root/b.before/container.txt" "$root/b.before/logs.sha256" >>"$root/unaffected.before.sha256"
    restore_instance 55ai "$A_PREVIOUS_DIR" "$A_SETTINGS_JSON" "$A_COMPOSE_FILE" "$A_VHOST_FILE" "$A_PROVENANCE_FILE" "$A_SETTINGS_APPLY_SCRIPT" "$A_HEALTH_URL" "$A_CONTAINER"
    instance_manifest ai16888 "$B_SETTINGS_JSON" "$B_COMPOSE_FILE" "$B_VHOST_FILE" "$B_PROVENANCE_FILE" "$B_CONTAINER" "$B_LOG_DIR" "$root/b.after"
    cp "$root/b.after/files.sha256" "$root/unaffected.after.sha256"
    cat "$root/b.after/container.txt" "$root/b.after/logs.sha256" >>"$root/unaffected.after.sha256"
    ;;
  ai16888)
    cp "$root/a.before/files.sha256" "$root/unaffected.before.sha256"
    cat "$root/a.before/container.txt" "$root/a.before/logs.sha256" >>"$root/unaffected.before.sha256"
    restore_instance ai16888 "$B_PREVIOUS_DIR" "$B_SETTINGS_JSON" "$B_COMPOSE_FILE" "$B_VHOST_FILE" "$B_PROVENANCE_FILE" "$B_SETTINGS_APPLY_SCRIPT" "$B_HEALTH_URL" "$B_CONTAINER"
    instance_manifest 55ai "$A_SETTINGS_JSON" "$A_COMPOSE_FILE" "$A_VHOST_FILE" "$A_PROVENANCE_FILE" "$A_CONTAINER" "$A_LOG_DIR" "$root/a.after"
    cp "$root/a.after/files.sha256" "$root/unaffected.after.sha256"
    cat "$root/a.after/container.txt" "$root/a.after/logs.sha256" >>"$root/unaffected.after.sha256"
    ;;
  *) echo "FAIL invalid AFFECTED_INSTANCE=$AFFECTED_INSTANCE" >&2; exit 1 ;;
esac

cmp -s "$root/unaffected.before.sha256" "$root/unaffected.after.sha256" || {
  echo "FAIL unaffected instance changed during rollback" >&2
  exit 1
}
echo "PASS rollback isolated affected=$AFFECTED_INSTANCE"
