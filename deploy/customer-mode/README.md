# Independent Canvas Deployments

The two vhosts are intentionally separate. `canvas.55ai.xyz` proxies only to `55ai.xyz` and listens on loopback port `3311`; `canvas.ai16888.com.cn` proxies only to `sub2.ai16888.com.cn` and listens on loopback port `3312`.

Run `sh check-vhosts.sh` before installing either vhost. The redacted access log excludes query strings, authorization headers and request bodies.

The Compose manifests deliberately bind only to loopback and mount no host volume. Run `sh check-manifests.sh` before deployment. The provenance JSON files use `pending-build` until an immutable image digest and canonical public fork commit URL are recorded; they are not production release claims.
