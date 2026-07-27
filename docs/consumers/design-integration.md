# Consumer Design Integration

> **Role:** Normative consumer-boundary contract
> **Applies to:** Any application or library that imports, aliases, wraps, or embeds FsusUI
> **Authority:** Applies FsusUI public contracts to consumers. It does not define consumer business logic or replace consumer-owned layout rules.

A consumer inherits FsusUI public components, tokens, interaction semantics, accessibility behavior, and documented variants. It does not inherit a complete route-level product design for every public, marketing, reading, or business workflow.

## 1. Ownership boundary

FsusUI owns:

- public component API and component geometry;
- canonical and public theme/motion tokens;
- the unique viewport / safe-area CSS contract (`--fsus-viewport-block-size`,
  `--fsus-safe-area-inset-{top,right,bottom,left}`) and component geometry that
  consumes it;
- component states and keyboard behavior;
- shared accessibility semantics;
- documented task-surface defaults;
- reusable navigation, overlay, form, data-region, and feedback primitives;
- Web/Avalonia conformance and registered platform differences.

The consumer owns:

- routes, information architecture, business workflows, and product copy;
- page composition and content priority;
- public, marketing, editorial, and product-specific reading layouts;
- the document-level viewport meta, including `viewport-fit=cover` when
  safe-area insets must be non-zero on notched devices;
- selection among documented component variants;
- consumer-specific tokens under `--{consumer-name}-*`;
- consumer fixtures and end-to-end evidence.

FsusUI does not rewrite `<meta name="viewport">` at runtime. Consumers must not
redeclare synonymous safe-area tokens, invent parallel `--fsus-safe-*` aliases,
override component-internal selectors (including `:deep(.el-overlay)`,
`.el-overlay-dialog`, `.el-overlay-message-box`, Drawer direction classes, or
ImageViewer control selectors) to reimplement safe-area or viewport math, or
ship a second viewport algorithm beside the FsusUI helpers.

## 2. Required adoption sequence

For a visual or UX change in a consumer:

1. Identify the imported or aliased FsusUI version/baseline.
2. Read [`docs/design.md`](../design.md), the relevant component docs, and the consumer’s own layout rules.
3. Classify the surface and owner using [`docs/design/change-classification.md`](../design/change-classification.md).
4. Use public components, props, slots, tokens, and documented composition patterns.
5. Keep product-specific layout and copy in the consumer.
6. Validate the consumer’s realistic states, viewports, themes, locales, and content lengths.
7. If a reusable FsusUI defect is exposed, fix it in FsusUI and verify the consumer against the same FsusUI revision.

## 3. Prohibited integration patterns

A consumer MUST NOT:

- target undocumented FsusUI DOM, private CSS selectors, generated file paths, XAML template parts, or internal imports;
- create fake `--fsus-*` tokens or redefine canonical FsusUI values;
- use `:deep()` or equivalent private styling to repair FsusUI component geometry;
- add a compatibility wrapper that hides an FsusUI defect;
- fork a component locally because its documented default is inconvenient;
- modify FsusUI defaults to solve one route-level composition problem;
- copy the contents of `docs/design.md` into the consumer and allow the copy to drift;
- infer a marketing or editorial layout from task-surface defaults;
- label an ordinary surface expressive or glass merely to obtain a visual effect.

A product-specific wrapper is allowed only when it adds product semantics or composition without replacing the FsusUI primitive or bypassing its public contract.

## 4. Consumer tokens

Consumer-specific visual names use the consumer namespace, for example:

```css
:root {
  --fsusblog-content-max-width: 72rem;
  --fsusblog-reading-gap: 2rem;
}
```

These tokens may map to public FsusUI or Element Plus compatibility tokens. They must not masquerade as new FsusUI truth:

```css
/* Allowed: consumer-owned mapping. */
.fsusblog-shell {
  color: var(--fsus-ink);
  background: var(--fsus-page);
  border-color: var(--el-border-color-lighter);
}

/* Not allowed: fabricated FsusUI token. */
:root {
  --fsus-card-premium-radius: 20px;
}
```

## 5. Surface-specific rules

### Task surfaces

Use FsusUI task primitives, density, action hierarchy, form, data-region, and overlay contracts. Consumer composition should remain quiet and task-oriented.

### Public and reading surfaces

The consumer MUST maintain explicit rules for page hierarchy, content width, responsive navigation, reading rhythm, media treatment, and route-level composition. Reuse FsusUI primitives without importing admin card grids or task density into public content.

### Marketing surfaces

FsusUI does not provide a complete marketing system. The consumer owns hero, campaign, offer, CTA, and promotional composition. FsusUI’s prohibitions and public component contracts still apply where FsusUI components are used.

## 6. Defect routing

Treat a problem as an FsusUI defect when the public primitive is incorrect across valid consumers or violates its documented contract. Fix the owning FsusUI source, tests, documentation, and platform mappings as required.

Treat a problem as a consumer defect when the primitive is used incorrectly, the page hierarchy is product-specific, or the consumer overrides public contracts.

Do not fix both sides by adding a compatibility layer. Use one owning implementation and one verified integration.

## 7. Reusable Skill availability

The canonical `fsusui-design-conformance` Skill lives in the FsusUI repository under `.agents/skills/`. It is discovered automatically when Codex runs in a workspace scope that exposes that directory. A separate consumer repository may expose the exact canonical Skill through its workspace configuration or a revision-pinned copy, but it must not fork the workflow or embed copied design values. The consumer must record which FsusUI revision supplies the Skill and documents.

The Skill is optional execution assistance. The documents and public contracts remain authoritative even when the Skill is unavailable or not activated.

## 8. Consumer evidence

Consumer visual acceptance should cover the states relevant to the route, including:

- realistic short and long content;
- empty, loading, error, success, disabled, and permission states;
- supported locales and text expansion;
- light and dark themes;
- narrow and wide viewports;
- keyboard order, focus visibility, zoom, and overflow;
- the exact FsusUI baseline used for acceptance.

A passing FsusUI component fixture does not prove the consumer page composition, and a passing consumer screenshot does not authorize changing FsusUI defaults.
