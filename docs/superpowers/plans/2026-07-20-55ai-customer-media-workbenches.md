# 55AI Customer Media Workbenches Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan.

**Goal:** Open the prompt library and video workbench for 55AI customer mode only, while leaving ai16888 untouched.

**Architecture:** Extend the existing customer-mode allowlists instead of bypassing the route and capability guards globally. Add a prompt-library-specific permission so public GitHub prompt sources can load in the browser without reopening plugins, WebDAV, model scripts, or Agent controls. Preserve the current-origin API normalization and IndexedDB media storage.

**Tech Stack:** React, TypeScript, React Router, Zustand, Vitest, Vite, Docker Compose, SSH/Nginx deployment.

---

## Chunk 1: Customer-mode policy tests

**Files:**
- Modify: `web/src/lib/__tests__/customer-navigation.spec.ts`
- Modify: `web/src/lib/__tests__/customer-mode.spec.ts`
- Modify: `web/src/lib/__tests__/customer-config-ui.spec.ts`
- Modify: `web/src/stores/__tests__/customer-mode-config.spec.ts`
- Modify: `web/src/lib/__tests__/customer-feature-gates.spec.ts`

- [ ] Write failing assertions for customer navigation containing `video` and `prompts`, route access for both paths, generation modes including video, and customer channel normalization retaining video models while rejecting audio.
- [ ] Write failing assertions that prompt-source execution is allowed in customer mode while audio, plugin, WebDAV, model-plugin, and Agent operations remain blocked.
- [ ] Run the focused Vitest files and confirm failures come from the current customer-mode restrictions.

## Chunk 2: Open 55AI customer capabilities

**Files:**
- Modify: `web/src/lib/customer-mode.ts`
- Modify: `web/src/services/api/prompts.ts`
- Modify: `web/src/services/api/prompt-source-runtime.ts`
- Modify: `web/src/constant/navigation-tools.ts` (only if policy filtering requires no structural change)
- Modify: `web/src/hooks/use-prompt-source-scheduler.ts` (only if prompt refresh remains incorrectly disabled)

- [ ] Add `video` to customer-supported model capabilities and generation modes; keep `audio` excluded.
- [ ] Add `video` and `prompts` to the customer route allowlist.
- [ ] Add a dedicated prompt-library guard that permits browser prompt-source reads in customer mode without weakening `assertCapabilityEnabled` for unrelated services.
- [ ] Use the dedicated guard in prompt fetching/runtime only; keep customer prompt-source editing and scheduler policy unchanged unless required for initial prompt loading.
- [ ] Run the focused tests and verify the new tests pass while unrelated customer feature-gate tests stay green.

## Chunk 3: Verification and 55AI release

**Files:**
- Modify: `deploy/customer-mode/provenance-55ai.json` if the release status needs a new source/build record.
- Do not modify: any `deploy/customer-mode/*ai16888*` file, ai16888 provenance, or ai16888 container.

- [ ] Run all web tests, typecheck, production build, manifest checks, vhost checks, and acceptance-script checks.
- [ ] Build and publish a new immutable 55AI image from the tested commit only; do not rebuild or restart ai16888.
- [ ] Recreate only `infinite-canvas-55ai` on the remote host using its existing Compose project and verify the image digest, container health, and restart count.
- [ ] Verify public 55AI navigation and `/video`/`/prompts` pages with browser smoke checks; confirm ai16888 container identity and image digest are unchanged.
- [ ] Commit the implementation and deployment provenance, push the 55AI source branch, and report exact verification results and the video-model configuration step.
