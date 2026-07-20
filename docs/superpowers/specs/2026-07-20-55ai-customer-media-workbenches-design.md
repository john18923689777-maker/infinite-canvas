# 55AI Customer Media Workbenches

## Goal

Expose the existing Infinite Canvas prompt library and video workbench to 55AI customers while keeping ai16888 unchanged and preserving per-origin configuration and browser-local media storage.

## Scope

- 55AI customer mode exposes `/prompts` and `/video` in desktop and mobile navigation.
- 55AI customer mode permits video model capability selection and video API calls.
- 55AI customer mode permits the built-in prompt-source runtime and prompt-library reads.
- Existing customer isolation remains in force: API base URLs resolve to the current origin, external channel URLs remain disallowed, and customer data stays in browser IndexedDB.
- Audio, plugins, WebDAV synchronization, Agent controls, and prompt-source editing remain disabled in customer mode.
- ai16888 is not changed in this release.

## Data Flow

Customers configure their own 55AI channel and video model in the existing channel UI. The video workbench calls the current origin's compatible `/videos` endpoints and stores generated media/logs in the browser's existing IndexedDB stores. The prompt library executes only the existing configured prompt-source scripts in the browser, fetches public GitHub content, caches normalized prompts in IndexedDB, and never sends prompt data to the 55AI server.

## Safety Boundaries

- `customerConfigChannel` retains only `image`, `video`, and `text` model entries and strips scripts and external base URLs.
- Audio capability remains rejected by the customer capability guard.
- Prompt-library access gets a dedicated allowlist rather than weakening the shared guard used by plugins, WebDAV, model plugins, and Agent operations.
- No deployment manifest, ai16888 file, or cross-site configuration is modified.

## Acceptance Criteria

- Customer navigation contains `视频创作台` and `提示词库`.
- Customer route guard allows `/video` and `/prompts`.
- Customer generation modes include `image`, `text`, and `video`, but not `audio`.
- Customer channel normalization preserves video models and continues to reject audio models and external URLs.
- Prompt source reads work in customer mode; plugin/WebDAV/Agent gates remain closed.
- Existing 55AI image generation behavior and cross-site isolation tests remain green.
- Production build and customer-mode manifest checks pass before deployment.
