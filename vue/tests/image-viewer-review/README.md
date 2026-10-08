# ImageViewer ordinary interaction regressions

This production-built fixture uses the public package entry to exercise an
appended Dialog above ImageViewer, native wheel scrolling in a long caption,
and contain/original/contain switching with and without CSP-safe rendering.
The tests interact with public controls and read rendered dimensions and inert
state; they do not repair application DOM, styles or focus ownership.

Run from the repository root after preparing the documented build tooling and
browser engines:

```sh
pnpm build:theme
pnpm exec playwright test --config vue/playwright.image-viewer-review.config.ts
```

Chromium and WebKit run separately through their standard Playwright projects.
Use `FSUS_IMAGE_VIEWER_REVIEW_PORT` to select an isolated server port.

The nested Dialog case is a retained failing control pending the canonical
focus-owner suspension handoff. The caption and original-size corrections can
be checked independently with `--grep 'wheel|original size'`. That focused
result does not establish that the whole modal composition suite passes.
