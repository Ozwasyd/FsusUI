# Release-Critical Playwright Suite Registry

> **Role:** Normative suite registry
> **Authority:** `spec/ci/playwright-suites.json`,
> `spec/ci/playwright-suites.schema.json`, and
> `spec/ci/playwright-project-contracts/*.json`
> **Checks:** `pnpm ci:playwright:plan` and `pnpm ci:playwright:check`

This registry is the only hand-edited authority for suite IDs, package command,
Playwright config, browser × viewport × theme × runtime cells, CI ownership,
impact roots, artifact namespace, and skip policy. Workflow YAML and issue text
must not define a second matrix.

## Dimension semantics

| Dimension | Meaning | Excludes |
| --- | --- | --- |
| `browser` | `chromium`, `firefox`, or `webkit` | `desktop-dark` |
| `viewport` | `desktop`, `mobile`, or `tiny` | Browser identity |
| `theme` | `light` or `dark` | Browser identity |
| `safeArea` | Safe-area geometry cell | Viewport label |
| `runtimeMode` | `ssr`, `reuse`, or `product` | Shards, workers, test count |

Shard, worker, and test counts are capacity details, not compatibility
coverage.

## Fixed suite IDs

1. `view-transitions` — three browsers
2. `motion-ssr` — Chromium SSR
3. `dom-layout` — Chromium × viewport × theme
4. `geometry-smoke` — Chromium
5. `markdown-editor-interaction` — three browsers
6. `visual-boundary-audit` — viewport/theme plus safe-area cells
7. `visual-runtime-reuse` — runtime contract only; not product browser coverage
8. `web-interaction-conformance` — Chromium, Firefox, and WebKit interaction cells

Each suite’s JSON project contract is authoritative for project names and
dimensions. Registry cells must match it 1:1, and config files must declare the
same names so renames fail validation.

## Commands and workflow binding

```bash
pnpm ci:playwright:plan --group pr
pnpm ci:playwright:plan --group main
pnpm ci:playwright:plan --group nightly
pnpm ci:playwright:plan --group release --json
pnpm ci:playwright:check
```

These commands are offline and do not install browsers or start servers.
`runBinding` is always `current-workflow-run`; release plans never point to
historical external evidence. The reusable workflow derives execution-owner
cells from this registry. `web-interaction-conformance` has one owner and runs
each browser project once through `pnpm test:conformance:web-interaction`.
