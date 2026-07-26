# Visual Change Workflow

> **Role:** Normative implementation and review workflow
> **Applies to:** FsusUI component/theme/motion/layout changes and visual changes in applications that consume FsusUI
> **Authority:** Executes the contracts in `spec/`, `docs/design.md`, domain documentation, and consumer rules. It cannot redefine them.

Use this workflow whenever rendered output, interaction states, visual geometry, theme behavior, motion, icons, responsive layout, documentation examples, or consumer composition changes.

## 1. Establish the baseline

- Record the repository and revision being changed.
- For a consumer, record the exact FsusUI revision, package version, workspace alias, or linked checkout.
- Identify the affected component, route, fixture, platform, and existing visual evidence.
- Do not evaluate a consumer against one FsusUI revision and implement against another.

## 2. Read the owning contracts

Read only the relevant sources, but always include:

1. [`docs/design.md`](../design.md)
2. [`docs/design/governance.md`](../design/governance.md)
3. [`docs/design/change-classification.md`](../design/change-classification.md)
4. the nearest token, component, UX, API, or platform contract
5. [`docs/consumers/design-integration.md`](../consumers/design-integration.md) for downstream products

Do not substitute a Skill summary, issue description, screenshot, or model preference for these sources.

## 3. Classify and state the allowed change

Before editing, record:

- owner: specification, FsusUI Web/Vue, FsusUI Avalonia, platform override, or consumer;
- surface and role;
- public behavior and visual states affected;
- files and adjacent areas explicitly out of scope;
- whether the change alters design intent or only restores conformance.

If the requested effect would require reclassifying the surface, adding a new token, or changing design intent, stop treating it as a local styling fix and follow the design-contract change process.

## 4. Inspect before changing

- Render or inspect the current state when possible.
- Use realistic content rather than placeholder-only data.
- Check existing component, fixture, and consumer usage before adding a primitive.
- Identify the actual failure: hierarchy, composition, component defect, token drift, interaction, accessibility, platform difference, or consumer override.

Do not infer a visual problem solely from source code when rendered evidence is available.

## 5. Implement the smallest coherent fix

- Change the owning source only.
- Reuse canonical tokens and public primitives.
- Preserve information architecture and adjacent visual behavior unless explicitly in scope.
- Update implementation, focused tests, fixtures, and nearest documentation together.
- Do not add a consumer compatibility layer for an FsusUI defect.
- Do not weaken tests, thresholds, or checkers to accept the new output.
- Do not update snapshots before confirming that the changed baseline is intentional.

## 6. Select verification by impact

Use the repository-defined commands rather than inventing a parallel test path.

For FsusUI rendered changes, start with:

```bash
pnpm run check:design-source-drift
pnpm run check:anti-ai-visual
pnpm run tokens:check
pnpm run tokens:lint
pnpm run verify:visual:affected
```

Add focused type, unit, interaction, accessibility, motion, platform, package, or consumer checks according to [`docs/design/change-classification.md`](../design/change-classification.md). Global token, typography, foundation, public-shell, or other `full-required` changes must follow the recommendation emitted by the visual planner.

For a consumer, use its own tests and screenshot matrix while preserving the FsusUI baseline and public-contract checks.

## 7. Inspect rendered evidence

Inspect, rather than merely generate, the affected evidence:

- default and changed interaction states;
- light and dark themes;
- relevant desktop and mobile viewports;
- realistic short, long, empty, loading, error, and permission content;
- supported locales and text expansion;
- keyboard focus, zoom, overflow, and reduced motion when applicable;
- Web/Avalonia or consumer comparisons when cross-platform or downstream behavior changes.

A zero visual diff proves only that covered baselines did not change. It does not prove a new state that lacks a fixture.

## 8. Review against the design contract

Reject or revise the change when it:

- creates a parallel design rule or unregistered value;
- increases focal points without a product requirement;
- adds surfaces, cards, badges, icons, copy, motion, or decoration to fill space;
- uses a consumer override to mask an FsusUI defect;
- moves product-specific composition into FsusUI;
- obtains an effect by misclassifying a surface;
- passes only because a checker, threshold, or baseline was weakened;
- looks correct only with placeholder content or one viewport.

## 9. Completion evidence

Report:

1. baseline revision and ownership classification;
2. files changed and design sections applied;
3. public contracts, tokens, states, and consumers affected;
4. commands run and exact results;
5. viewports, themes, locales, states, and platforms inspected;
6. screenshots, traces, reports, or failure evidence produced;
7. remaining uncertainty and any verification not completed;
8. confirmation that no parallel design system or compatibility layer was introduced.

Do not claim visual acceptance when rendered evidence was not inspected.
