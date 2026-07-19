#!/bin/sh
set -eu

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TESTS="$DIR/tests"

require() {
  file=$1
  needle=$2
  grep -F "$needle" "$TESTS/$file" >/dev/null || {
    echo "FAIL $file: missing $needle" >&2
    exit 1
  }
}

for needle in 'snapshot_instance before' 'snapshot_instance after' 'docker diff' 'docker inspect' 'scan_log' 'after-generation.marker'; do
  require storage-scan.sh "$needle"
done
if grep -F 'cp "$before"' "$TESTS/storage-scan.sh" >/dev/null; then
  echo "FAIL storage-scan.sh: after snapshot must not copy before snapshot" >&2
  exit 1
fi

for needle in 'assert_openai_image' '/v1/images/edits' 'OpenAI reference edit' 'OpenAI mask edit' 'assert_gemini_image' 'inlineData' 'Gemini reference generation' 'assert_expected_error' 'after-generation.marker'; do
  require image-acceptance.sh "$needle"
done

for needle in 'X-Canvas-Acceptance-Trace' '/v1/images/generations' 'TRACE_LOG_A' 'TRACE_LOG_B' 'assert_trace_isolated' 'frame-ancestors' 'X-Frame-Options'; do
  require routing-negative.sh "$needle"
done

for needle in 'restore_instance' 'docker compose' 'nginx -t' 'unaffected.before.sha256' 'unaffected.after.sha256' 'cmp -s'; do
  require rollback-drill.sh "$needle"
done

for needle in 'indexedDB' 'frame-src' 'frame-ancestors' 'x-frame-options' 'token' 'user_id' 'src_host' 'src_url' '.reload' 'deleteDatabase'; do
  require browser-smoke.spec.ts "$needle"
done

echo "PASS acceptance script contracts"
