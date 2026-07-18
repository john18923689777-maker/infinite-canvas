# Sub2 Customer Build

This repository is a customer-oriented fork of [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas), licensed under the upstream [GNU Affero General Public License v3.0](LICENSE).

## Baseline provenance

- Upstream repository: `https://github.com/basketikun/infinite-canvas`
- Upstream attribution commit: `bdca6b0a5c193b8c85dfbf7c6a433d62f02da9df`
- Local customer-fork baseline commit: `66922a8ba02f5f6bc0396d6862c7b78f39b921a2`

This local baseline is not a release and is not a public source offer. The upstream attribution commit identifies the starting point only; it does not identify this modified fork's source.

## Release source-offer gate

Before any customer release is published or distributed, the release authority must supply and record the exact canonical public URL for the corresponding commit in this fork. That literal public fork-commit URL is the release's source offer and must resolve to the released commit. No release artifact may be created until that URL is available and verified.

## Customer-mode policy

Customer builds exclude upstream developer and uncontrolled-extension capabilities:

- Local Canvas Agent connections, including Codex and Claude Code integrations.
- Codex App plugin installation and registration.
- Remote node-plugin installation, updates, and removal.
- Default third-party prompt-source feeds.

These restrictions are part of the customer-mode product boundary and must remain disabled in customer release artifacts.

The README advertises upstream full-workbench capabilities for attribution, while customer builds disable the paths listed above.
