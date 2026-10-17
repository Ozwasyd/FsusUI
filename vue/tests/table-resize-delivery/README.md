# Ordinary public Table resize delivery regression

This fixture retains the reported public `ElTable` / `ElTableColumn` / `ElButton`
rendering input: 50 rows, four columns, desktop 1440×900 ↔ narrow 390×844, three
round trips, three animation frames after each change, and zero native errors.
`original-replay.mjs` preserves the original window error listener and assertion.
`Primitive.vue`, `main.ts`, and `index.html` are the original rendering fixture.
`Modes.vue` adds separate fixed-column, fit=false, flexible, auto-layout, height,
container-resize and unmount/remount coverage without changing the original.

Use a real FsusBlog checkout with its locked frontend dependencies and a real
FsusUI checkout with generated icons, WASM and public theme CSS. No installed
private FsusUI package or component stubs are required. The Vite config uses
FsusBlog's official `createFsusUiAliases`, points the public package import and
both public CSS imports to FsusUI, and deduplicates Vue to the FsusBlog instance.

From the FsusUI repository, set absolute checkout roots:

```sh
export FSUSBLOG_ROOT=/workspace/FsusBlog
export FSUSUI_ROOT=/workspace/FsusUI
export FSUS_PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium
node "$FSUSBLOG_ROOT/src/frontend/node_modules/vite/bin/vite.js" --config vue/tests/table-resize-delivery/vite.config.mts
```

In another terminal, from the same FsusUI repository:

```sh
node vue/tests/table-resize-delivery/original-replay.mjs
node node_modules/@playwright/test/cli.js test --config vue/tests/table-resize-delivery/playwright.config.mts
node node_modules/vitest/vitest.mjs run --config vue/vitest.config.ts vue/packages/components/table
```

The browser regression checks final column and container geometry plus delivery
from additional read-only native root/body observers after every original
viewport change. It preserves a zero-error assertion, checks 50 rows after every
change, and requires identical geometry on repeated narrow and desktop states.
The ordinary unit regression uses controlled observer callbacks and animation
frames to check scheduling, overflowing container-width caching, fixed-column
widths, height measurement, fit=false resizing, and lifecycle cleanup. It is not
used as evidence for native browser delivery.

To replay the historical baseline, select FsusUI revision
`f2b3bb89ffe5f749da26c388f058efdbb6aee864` and FsusBlog revision
`cda0b05d5c975b5ef6644b57174052b4a7ab5551` using the same fixture and environment
variables. Keep the locked dependencies unchanged and rebuild the public theme
CSS from that UI checkout. Browser test artifacts go to the executor's temporary
directory; the original replay prints all native window error records and fails
unless the count is zero.
