# Playground And Demo App

The current public playground is the Vite demo app in `packages/demo-app`. It
remains a development app, but its examples must be safe for public-preview
evaluation.

## Run The Demo

```bash
pnpm -C packages/demo-app dev
```

The dev server uses port `5173` by default. Previewing a built demo uses:

```bash
pnpm -C packages/demo-app build
pnpm -C packages/demo-app preview
```

The root build helper is:

```bash
pnpm run build:demo
```

## What The Demo Covers

The default gallery is split into sections:

| Section          | File                                                        |
| ---------------- | ----------------------------------------------------------- |
| Basic            | `packages/demo-app/src/sections/BasicSection.vue`           |
| Form             | `packages/demo-app/src/sections/FormSection.vue`            |
| Data             | `packages/demo-app/src/sections/DataSection.vue`            |
| Navigation       | `packages/demo-app/src/sections/NavigationSection.vue`      |
| Feedback         | `packages/demo-app/src/sections/FeedbackSection.vue`        |
| Others           | `packages/demo-app/src/sections/OthersSection.vue`          |
| Icons            | `packages/demo-app/src/sections/IconsSection.vue`           |
| Markdown stress  | `packages/demo-app/src/sections/MarkdownStressSection.vue`  |
| Issue primitives | `packages/demo-app/src/sections/IssuePrimitivesSection.vue` |

The demo also has UI audit routes and metadata in
`packages/demo-app/src/ui-audit-manifest.ts`.

## Add A Demo

1. Add the example to the closest section file.
2. Use neutral fixture text and synthetic data.
3. Keep controls reachable by keyboard.
4. Add labels for icon-only buttons and custom interactive elements.
5. Prefer public package imports or existing demo component registration.
6. Update visual tests or audit metadata when the demo changes a covered state.

## Visual Regression Relationship

Visual snapshots under `tests/visual/demo-app.spec.ts-snapshots/` are generated
from the demo app. The main command is:

```bash
pnpm run test:visual
```

Focused Playwright specs live under `tests/visual/`, including demo smoke,
interactive audit, UI audit, scroll motion, and issue primitive coverage.

When a demo change intentionally changes screenshots, update the relevant
snapshots in the same change and explain why in the commit or pull request.

## Public Sample Rules

- Do not use private sample content, real user data, customer names, secrets,
  internal URLs, or private image attachments.
- Do not present FsusBlog-only adapters as general-purpose FsusUI API.
- Keep examples small enough that users can inspect behavior quickly.
- Keep public docs and demo labels aligned with API stability docs.
- Prefer component states that help users evaluate accessibility, theme, motion,
  and responsive behavior.
