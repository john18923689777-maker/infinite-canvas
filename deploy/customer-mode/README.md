# Independent Canvas Deployments

The two vhosts are intentionally separate. `canvas.55ai.xyz` proxies only to `55ai.xyz` and listens on loopback port `3311`; `sub.ai16888.com.cn` proxies only to `sub2.ai16888.com.cn` and listens on loopback port `3312`. The ai16888 vhost uses the temporary subdomain; the formal root domain remains owned by the Sub2API site.

Run `sh check-vhosts.sh` before installing either vhost. The redacted access log excludes query strings, authorization headers and request bodies.

The Compose manifests deliberately bind only to loopback and mount no host volume. Run `sh check-manifests.sh` before deployment. The provenance JSON files use `pending-build` until an immutable image digest and canonical public fork commit URL are recorded; they are not production release claims.

## Release gates

Run `sh check-acceptance-scripts.sh` and the repository test/build commands before building an image. Production acceptance is intentionally fail-closed and requires real per-instance fixtures:

- `routing-negative.sh` needs both parent/canvas URLs, two instance-specific keys, the Gemini image model and either `SUB2_CONTAINER_A/B` or current `TRACE_LOG_A/B` files. It correlates unique `X-Request-ID` values against both Sub2API logs and validates both parent and child iframe CSP headers.
- `image-acceptance.sh` needs a real reference image, same-size PNG mask, separate A/B keys, wrong-group/no-image-permission/empty-balance/rate-limit fixtures and explicit upstream-5xx fixture routes. It validates decoded OpenAI and Gemini image payloads before creating `after-generation.marker`.
- `storage-scan.sh` starts before image acceptance. It requires the two redacted outer Nginx access-log paths, records real before/after `docker inspect` and `docker diff` snapshots, rejects mounts or new media artifacts and scans logs without printing secrets.
- `browser-smoke.spec.ts` performs one small generation on each origin, writes the resulting Blob and a project record to that origin's IndexedDB, reloads, verifies cross-origin separation, deletes both records and exercises desktop/mobile iframe policies.
- `rollback-drill.sh` requires one previous bundle per instance containing `settings.json`, `compose.yml`, `vhost.conf` and `provenance.json`, plus a per-instance executable settings-apply script. It restores and recreates only `AFFECTED_INSTANCE`, verifies the previous image and health endpoint, and compares the other instance's files, container identity and log tree byte-for-byte.

The two settings-apply scripts and all staging keys are deployment secrets. Keep them outside this repository. Never reuse a fixture, rollback bundle or access log between the two operating systems.
