# Release-critical Playwright suite registry

`spec/ci/playwright-suites.json` is the only hand-edited authority for release-critical Playwright suites, execution cells, profile membership, impact roots, and evidence namespaces. Workflows and Playwright configs consume the registry through deterministic planners instead of maintaining browser or project arrays of their own.

## Dimensions

- `browser` is the Playwright engine: `chromium`, `firefox`, or `webkit`.
- `project` is the stable config project identity.
- `viewport` and `theme` describe layout cells. A project such as `desktop-dark` is not a browser.
- `safeArea` separates the safe-area-only corpus from ordinary boundary tests.
- `runtimeMode=prepared-reuse` identifies a runtime identity contract. It does not add product browser coverage.

Shard counts, workers, retries, and test counts are execution capacity, not compatibility dimensions.

## Commands

```bash
pnpm ci:playwright:check
pnpm ci:playwright:plan --group pr
pnpm ci:playwright:plan --group main --json
pnpm ci:playwright:plan --group nightly --json
pnpm ci:playwright:plan --group release --json
pnpm test:ci-playwright-registry
```

Planning is read-only. It does not install browsers, start servers, access the network, or write generated files. Release plans bind evidence to the current workflow run; a nightly receipt cannot satisfy a release cell.
