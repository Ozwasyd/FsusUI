# Playground And Demo App

The public playground is the Vite demo app in `vue/packages/demo-app`. It is a
development app, but examples must remain safe for public-preview evaluation.

## Run The Demo

```bash
pnpm -C vue/packages/demo-app dev
```

The dev server uses port `5173` by default. Preview a built demo with:

```bash
pnpm -C vue/packages/demo-app build
pnpm -C vue/packages/demo-app preview
```

The root build helper is:

```bash
pnpm run build:demo
```

## What The Demo Covers

The default gallery sections are:

| Section          | File                                                            |
| ---------------- | --------------------------------------------------------------- |
| Basic            | `vue/packages/demo-app/src/sections/BasicSection.vue`           |
| Form             | `vue/packages/demo-app/src/sections/FormSection.vue`            |
| Data             | `vue/packages/demo-app/src/sections/DataSection.vue`            |
| Navigation       | `vue/packages/demo-app/src/sections/NavigationSection.vue`      |
| Feedback         | `vue/packages/demo-app/src/sections/FeedbackSection.vue`        |
| Others           | `vue/packages/demo-app/src/sections/OthersSection.vue`          |
| Icons            | `vue/packages/demo-app/src/sections/IconsSection.vue`           |
| Markdown stress  | `vue/packages/demo-app/src/sections/MarkdownStressSection.vue`  |
| Issue primitives | `vue/packages/demo-app/src/sections/IssuePrimitivesSection.vue` |

UI audit routes and metadata live in `vue/packages/demo-app/src/ui-audit-manifest.ts`.

## Add A Demo

1. Add it to the closest section file.
2. Use neutral fixture text and synthetic data.
3. Keep controls keyboard-reachable and label icon-only buttons/custom interactive elements.
4. Prefer public package imports or existing demo registration.
5. Update visual tests or audit metadata when a covered state changes.

## Visual Regression Relationship

Visual snapshots under `vue/tests/visual/demo-app.spec.ts-snapshots/` are generated
from the demo app. Run locally:

```bash
pnpm run verify:visual:affected
```

Use `pnpm run test:visual:full` for the authoritative four-project matrix or
`pnpm run test:visual:evidence` when successful artifacts must be retained. Unqualified
`test:visual` prints profile help; details live in [`visual-testing.md`](./visual-testing.md).

Focused Playwright specs under `vue/tests/visual/` cover demo smoke, interactive
and UI audits, scroll motion, and issue primitives.

When a demo change intentionally changes screenshots, update the relevant
snapshots in the same change and explain why in the commit or pull request.

## Public Sample Rules

- Do not use private sample content, real user data, customer names, secrets,
  internal URLs, or private image attachments.
- Do not present FsusBlog-only adapters as general-purpose FsusUI API.
- Keep examples inspectable, keep public docs and demo labels aligned with API stability docs,
  and prefer states that expose accessibility, theme, motion, and responsive behavior.
