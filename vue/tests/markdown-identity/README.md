# Public Markdown identity consumer

This FsusUI-owned fixture imports only the documented
`@ozwasyd/element-plus/markdown-runtime` entry, source-linked by its Vite config.
It needs no consuming application, backend, credentials, or private adapter.
It checks actual production-built browser execution, not installed-package parity
or browser Worker transport. Snapshot revival uses a real structured clone.

Run from the repository root after the locked dependency install:

```sh
pnpm run ensure:wasm
pnpm exec vue-tsc --noEmit -p vue/tests/markdown-identity/tsconfig.json
pnpm exec playwright test --config vue/playwright.markdown-identity.config.ts
```

The plain-ID control and four separator/Unicode IDs each exercise direct and
revived projections, unchanged node encoding, outline consumption, prefix edits,
deletion and recreation, stale epochs, cross-document rejection, anchor reveal
and selection round trips. All existing unit tests remain unchanged.

For a negative control, run this unchanged fixture on the main implementation
before the #850 resolver repair. Plain IDs must still pass their current-status
assertions; separator-bearing IDs must fail those assertions. The complete plain-ID
cases also check that a different document named `doc-a:other` is rejected as
`invalid`, not `deleted`; the old positional resolver fails that isolation check.
Record the exact two source revisions and actual outputs; do not treat expected
failures as candidate acceptance.

This internal fixture adds no consumer-visible contract beyond the patch
changeset already accompanying #850; an additional changeset is not needed.
