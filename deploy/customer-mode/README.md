# Independent Canvas Deployments

The two vhosts are intentionally separate. `canvas.55ai.xyz` proxies only to `55ai.xyz` and listens on loopback port `3311`; `canvas.ai16888.com.cn` proxies only to `sub2.ai16888.com.cn` and listens on loopback port `3312`.

Run `sh check-vhosts.sh` before installing either vhost. The redacted access log excludes query strings, authorization headers and request bodies.
