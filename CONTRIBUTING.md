# Contributing

FsusUI is in public preview. Contributions need enough context for maintainers
to evaluate API stability, visual output, accessibility, Element Plus
compatibility, and release-note impact.

## Security First

Do not report vulnerabilities in public issues, pull requests, discussions, or
demo screenshots. Follow [`SECURITY.md`](./SECURITY.md) instead.

## Local Setup

Required baseline:

- Node.js 22 or newer
- pnpm 10, matching the root `packageManager`

Install dependencies:

```bash
pnpm install
```

Useful checks:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run verify
```

Run the demo app:

```bash
pnpm -C packages/demo-app dev
```

## Contribution Workflow

1. Open or link an issue unless the change is a small internal maintenance fix.
2. State the public API, component, theme token, motion token, compatibility,
   accessibility, and visual impact in the pull request.
3. Add or update docs when behavior is public, preview, experimental, or
   intentionally unsupported.
4. Add focused tests for runtime behavior and visual coverage when UI output
   changes.
5. Add a changeset for user-facing package changes.

Component changes should name the affected component docs under
`docs/components/`. Theme and motion changes should reference
`docs/theme/tokens.md`, `docs/theme/customization.md`, or
`docs/theme/motion.md`.

## Changeset Workflow

Use Changesets for public package release notes and version bumps.

Create a changeset:

```bash
pnpm changeset
```

The workspace package name is currently `element-plus`; public preview
publishing maps the package to `@ozwasyd/element-plus`.

### When A Changeset Is Required

Add a changeset when a change affects external consumers:

- component props, events, slots, exposes, styles, or behavior
- public package exports or install behavior
- public theme tokens or motion tokens
- icons exported through `@ozwasyd/element-plus/icons-vue`
- accessibility behavior that changes user-visible interaction
- visual output that consumers may notice
- build artifacts, registry behavior, or consumer install behavior

### How To Write A Public-Facing Changeset

- Write for users, not maintainers.
- Name the affected component, API, token, or package path.
- Explain the behavior change and migration action.
- Mention docs or migration pages when relevant.
- Avoid internal implementation-only wording unless it affects users.

Example:

```md
---
'element-plus': minor
---

Add preview-public motion tokens for panel and overlay transitions. Consumers
can now align app-level transitions with ConfigProvider motion settings.
```

### Breaking Changes

Use a major changeset and start the summary with `BREAKING:` when a public API,
token, component behavior, import path, or runtime requirement stops working.
The pull request must also update migration docs or API stability docs.

### Internal-Only Changes

A changeset is not required for:

- test-only updates
- CI-only updates
- internal scripts that do not affect package output
- docs-only updates that do not change public behavior
- refactors with no public runtime, type, package, or visual impact

Mark the PR checklist item as "changeset not needed" and explain why.

### Changelog Generation

Maintainers generate version bumps and changelog entries from committed
changesets:

```bash
pnpm version-packages
```

Publishing must wait for release verification:

```bash
pnpm run verify:release
```

## Visual Regression Workflow

Run visual tests for UI, theme, motion, icon, layout, demo, or screenshot
changes:

```bash
pnpm run test:visual
```

Focused commands:

```bash
pnpm run test:visual:preview
pnpm run test:visual:dev
pnpm run test:visual:reuse
pnpm run audit:visual-boundaries
```

### Review Visual Diffs

- Check light and dark mode.
- Check desktop and mobile snapshots.
- Check reduced-motion behavior when animations, transitions, or motion tokens
  change.
- Review focus, hover, active, disabled, selected, loading, and error states
  when a component interaction changes.
- Compare snapshots under `tests/visual/demo-app.spec.ts-snapshots/`.

### Update Snapshots

Update snapshots only when the visual change is intentional. Include the
updated snapshots in the same pull request and explain the changed baseline in
the PR body.

Do not update snapshots to hide a regression. If a diff is caused by
environment drift, explain the local environment and ask for maintainer review.

### Include Screenshots In PRs

Attach before and after screenshots when the change affects:

- public component rendering
- theme or motion tokens
- responsive layout
- dark mode
- visual density, spacing, radius, or shadow
- icon geometry or naming

Use synthetic data and safe public examples only.

## Documentation Workflow

Public-facing changes should update the nearest relevant docs:

- component docs under `docs/components/`
- API stability in `docs/api-stability.md`
- Element Plus compatibility in `docs/element-plus-compatibility.md`
- migration notes in `docs/migration/from-element-plus.md`
- theme docs under `docs/theme/`
- icon docs in `docs/icons.md`
- playground docs in `docs/playground.md`

Docs must label preview and experimental APIs clearly.
