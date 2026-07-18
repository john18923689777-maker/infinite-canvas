# Sub2 Customer Build

This repository is a customer-oriented fork of [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas), licensed under the upstream [GNU Affero General Public License v3.0](LICENSE).

## Immutable upstream source

- Upstream repository: `https://github.com/basketikun/infinite-canvas`
- `SOURCE_COMMIT`: `bdca6b0a5c193b8c85dfbf7c6a433d62f02da9df`
- Source offer URL: `https://github.com/basketikun/infinite-canvas/tree/bdca6b0a5c193b8c85dfbf7c6a433d62f02da9df`

Release artifacts must derive their source offer URL deterministically as:

```text
https://github.com/basketikun/infinite-canvas/tree/${SOURCE_COMMIT}
```

`SOURCE_COMMIT` is immutable for a release and must name a commit that exists in the upstream repository. Release artifacts must resolve this template to a real commit URL; placeholders such as `${SOURCE_COMMIT}`, `<commit>`, or a branch URL are not acceptable source offers.

## Customer-mode policy

Customer builds exclude upstream developer and uncontrolled-extension capabilities:

- Local Canvas Agent connections, including Codex and Claude Code integrations.
- Codex App plugin installation and registration.
- Remote node-plugin installation, updates, and removal.
- Default third-party prompt-source feeds.

These restrictions are part of the customer-mode product boundary and must remain disabled in customer release artifacts.
