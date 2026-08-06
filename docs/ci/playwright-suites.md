# Release-critical Playwright suite registry

> **Authority:** `spec/ci/playwright-suites.json`  
> **Schema:** `spec/ci/playwright-suites.schema.json`  
> **Project cell contracts:** `spec/ci/playwright-project-contracts/*.json`  
> **Commands:** `pnpm ci:playwright:plan`, `pnpm ci:playwright:check`

## Purpose

Several Playwright entry points exist outside the generic visual orchestration
job. This registry is the **only hand-edited authority** for:

- which suite ids exist
- which package command and Playwright config each suite uses
- the full execution cell matrix (browser × viewport × theme × …)
- which CI profile (`pr` / `main` / `nightly` / `release`) owns each suite
- source impact roots, artifact namespaces, and skip policy

Workflow YAML and issue text must not invent a second matrix.

## Dimension semantics

| Dimension | Meaning | Not this |
|-----------|---------|----------|
| `browser` | Playwright engine: `chromium`, `firefox`, `webkit` | Never `desktop-dark` |
| `viewport` | Layout form factor: `desktop`, `mobile`, `tiny` | Not a browser |
| `theme` | Color scheme: `light`, `dark` | Not a browser |
| `safeArea` | Safe-area geometry matrix cell | Separate from viewport label |
| `runtimeMode` | `ssr`, `reuse`, or `product` | Shard/worker counts are not dimensions |

Shard count, worker count, and test count are capacity details — they are **not**
compatibility coverage.

## Fixed suite ids

1. `view-transitions` — three browsers  
2. `motion-ssr` — Chromium SSR cell  
3. `dom-layout` — Chromium × viewport × theme  
4. `geometry-smoke` — Chromium  
5. `markdown-editor-interaction` — three browsers  
6. `visual-boundary-audit` — viewport/theme + safe-area cells  
7. `visual-runtime-reuse` — **runtime contract only**; does **not** count toward product browser coverage  

## Pure-data project contracts

Each suite has a JSON contract under `spec/ci/playwright-project-contracts/`.
That file is the authority for Playwright project names and dimensions. The
registry cells must match it 1:1. Config files must declare the same project
names so renames fail the check.

## Commands

```bash
pnpm ci:playwright:plan --group pr
pnpm ci:playwright:plan --group main
pnpm ci:playwright:plan --group nightly
pnpm ci:playwright:plan --group release --json
pnpm ci:playwright:check
```

`plan` and `check` do not install browsers, start servers, or hit the network.
`runBinding` is always `current-workflow-run` — release never points at historical
external evidence.

## Workflow note

This registry does **not** by itself execute suites in Actions. Follow-up issues
wire cells into jobs and readiness aggregation. Until then, local commands remain
the execution entry points listed in `package.json`.
