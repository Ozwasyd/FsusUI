# Documentation Architecture

> **Role:** Normative documentation governance
> **Applies to:** FsusUI maintainers, contributors, automation, and consumer-facing documentation
> **Authority:** This document controls document placement and interpretation. It does not override `spec/`, `docs/design.md`, public API contracts, or generated sources.

FsusUI documentation is organized by **authority**, **audience**, and **lifecycle**. A document must have one primary role. Avoid creating a second document that restates an existing source of truth in different wording.

## 1. Authority layers

From highest to lowest authority:

1. **Platform-neutral specification** under [`spec/`](../../spec/README.md): canonical tokens, component contracts, interaction semantics, accessibility, motion, and registered platform differences.
2. **Human-readable design contract** in [`docs/design.md`](../design.md): the intended visual language and its component-level interpretation.
3. **Domain contracts** under `docs/api/`, `docs/theme/`, `docs/ux/`, `docs/components/`, and `docs/avalonia/`: public behavior and implementation-facing rules for one domain.
4. **Governance and workflows** under `docs/governance/` and `docs/workflows/`: how changes are classified, reviewed, verified, released, and documented.
5. **Consumer guides** under `docs/guide/`, `docs/consumers/`, and `docs/migration/`: how downstream applications adopt the public contracts.
6. **Records and generated output** under `docs/releases/`, `docs/performance/`, `docs/theme/generated/`, and release-evidence directories: evidence, generated references, and point-in-time status.
7. **Archive** under `docs/archive/`: retained history that no longer defines current behavior.

A lower layer may explain or apply a higher layer. It must not redefine it.

## 2. Document roles

| Role | Purpose | Normative | Typical location |
| --- | --- | --- | --- |
| Specification | Defines platform-neutral machine-readable or structured contracts | Yes | `spec/` |
| Design contract | Defines FsusUI visual intent and defaults | Yes | `docs/design.md` |
| Domain contract | Defines public API, token, UX, accessibility, component, or platform behavior | Yes | `docs/api/`, `docs/theme/`, `docs/ux/`, `docs/components/`, `docs/avalonia/` |
| Governance | Defines ownership, precedence, exceptions, release, and change policy | Yes | `docs/governance/` and stable governance entrypoints |
| Workflow | Defines repeatable implementation and verification steps | Procedural | `docs/workflows/` and stable workflow entrypoints |
| Guide | Helps a consumer perform a supported task | No, unless it links to a contract | `docs/guide/`, `docs/consumers/`, `docs/migration/` |
| Reference | Catalogs stable APIs, components, icons, or tokens | Derived | `docs/components/`, `docs/icons/`, generated reference directories |
| Record | Captures a release, audit, benchmark, roadmap, or readiness state | Point-in-time | `docs/releases/`, `docs/performance/`, audit documents |
| Archive | Preserves obsolete material for history | No | `docs/archive/` |

Every new substantive document should state its role, applicability, and authority near the top. Existing documents may adopt this metadata incrementally when they are materially revised.

## 3. Directory map

| Directory or file | Primary responsibility |
| --- | --- |
| [`docs/index.md`](../index.md) | Navigation only; it must not become a second source of truth |
| [`docs/design.md`](../design.md) | Stable human-readable design contract |
| [`docs/design/`](../design/README.md) | Design governance, interpretation, and change classification |
| [`docs/architecture/`](../architecture/README.md) | Repository, runtime, cross-platform, and implementation architecture map |
| [`docs/api/`](../api/cross-platform-api-boundary.md) | Public and cross-platform API boundaries |
| [`docs/theme/`](../theme/tokens.md) | Token, theme, customization, and motion contracts |
| [`docs/ux/`](../ux/dont-make-me-think-guidelines.md) | Platform-neutral task and interaction semantics |
| [`docs/components/`](../components/overview.md) | Web/Vue component reference and component-specific contracts |
| [`docs/avalonia/`](../avalonia/README.md) | Avalonia adoption, components, and documented platform differences |
| [`docs/guide/`](../guide/quickstart.md) | Consumer onboarding and supported usage guides |
| [`docs/consumers/`](../consumers/README.md) | FsusUI-to-product ownership and integration rules |
| [`docs/workflows/`](../workflows/README.md) | Repeatable development, visual-change, and maintenance workflows |
| [`docs/governance/`](./README.md) | Documentation, design, API, CI, and release governance map |
| [`docs/migration/`](../migration/from-element-plus.md) | Migration instructions and compatibility transitions |
| [`docs/releases/`](../releases/public-preview.md) | Release/readiness records and platform policy records |
| [`docs/release/`](../release/npm-registry-policy.md) | Registry and release-mechanism policy |
| [`docs/performance/`](../performance/real-render-benchmarks.md) | Performance methodology and results |
| [`docs/legal/`](../legal/element-plus-attribution.md) | Attribution and legal boundaries |
| [`docs/archive/`](../archive/github-packages/README.md) | Historical, non-current material |
| [`.agents/skills/`](../../.agents/skills/fsusui-design-conformance/SKILL.md) | Reusable agent workflows; procedural only, never a design or API source of truth |

## 4. Stable top-level entrypoints

Several documents remain at `docs/` root because scripts, tests, contributor links, or public references treat their paths as stable:

- `design.md`
- `index.md`
- `project-overview.md`
- `engineering-handoff.md`
- `visual-testing.md`
- `release-governance.md`
- `api-stability.md`
- `element-plus-integration.md`
- `element-plus-compatibility.md`
- `icons.md`
- `playground.md`
- existing runtime and cross-platform reports

Do not add another root-level document merely because its topic is important. New documents belong in the closest domain directory unless they are intentionally approved as stable entrypoints. Moving a stable entrypoint requires updating every script, test, link, and external reference in the same change; a forwarding stub is not sufficient when automation reads the file contents.

## 5. Placement decision

Before creating a document, answer in order:

1. Does an existing specification or contract already own the rule? Update it instead of adding another document.
2. Is the content a rule, a workflow, a consumer guide, a reference, or a point-in-time record?
3. Which product or platform owns it: FsusUI core, Web/Vue, Avalonia, or a consumer?
4. Is the content stable, generated, temporary, or historical?
5. Which existing index must link to it?

Do not use a broad “design”, “engineering”, or “notes” document as a catch-all.

## 6. Duplication and linking policy

- State each normative rule in one authoritative location.
- Other documents link to the rule and describe only their domain-specific application.
- Do not copy token values, radius budgets, motion durations, or color values into workflow or skill files.
- Examples are non-normative unless the authoritative document explicitly promotes them to a contract.
- A generated file must identify its generator and must not be edited manually.
- A point-in-time report must include its baseline, date or version, and status.
- A deprecated document must link to the current replacement and move to `docs/archive/` when it no longer serves an active compatibility purpose.

## 7. Change discipline

A documentation-only change must not silently alter product behavior. If wording changes the meaning of a public contract, treat it as a contract change and update the corresponding specification, tests, migration guidance, and release impact.

When a change touches design or rendered output, use:

- [`docs/design/governance.md`](../design/governance.md)
- [`docs/design/change-classification.md`](../design/change-classification.md)
- [`docs/workflows/visual-change.md`](../workflows/visual-change.md)
- [`docs/consumers/design-integration.md`](../consumers/design-integration.md) for downstream products
