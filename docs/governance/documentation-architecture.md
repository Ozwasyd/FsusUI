# Documentation Architecture

> **Role:** Normative documentation governance
> **Applies to:** FsusUI maintainers, contributors, automation, and consumer documentation
> **Authority:** Controls document placement and interpretation; it does not override `spec/`, `docs/design.md`, public API contracts, or generated sources.

Each document has one primary role, audience, and lifecycle. Do not create a
second source of truth by restating an existing contract.

## 1. Authority and roles

Precedence is:

1. [`spec/`](../../spec/README.md): platform-neutral tokens, component,
   interaction, accessibility, motion, icon, and platform-override contracts.
2. [`docs/design.md`](../design.md): the human-readable visual contract.
3. Domain contracts under `docs/api/`, `docs/theme/`, `docs/ux/`,
   `docs/components/`, and `docs/avalonia/`.
4. Governance, release policy, and workflows under `docs/governance/`,
   `docs/releases/`, and `docs/workflows/`.
5. Consumer guides under `docs/guide/`, `docs/consumers/`, and `docs/migration/`.
6. Records and generated output under `docs/releases/evidence/`,
   `docs/releases/readiness/`, `docs/performance/`, and generated references.
7. [`docs/archive/`](../archive/github-packages/README.md): retained history.

A lower layer may explain or apply a higher layer, never redefine it.

| Role | Purpose | Typical location |
| --- | --- | --- |
| Specification | Machine-readable/platform-neutral contract | `spec/` |
| Design contract | Visual intent and defaults | `docs/design.md` |
| Domain contract | API, token, UX, accessibility, component, or platform behavior | `docs/api/`, `docs/theme/`, `docs/ux/`, `docs/components/`, `docs/avalonia/` |
| Governance | Ownership, precedence, exceptions, release, and change policy | `docs/governance/`, stable entrypoints |
| Workflow | Repeatable implementation and verification | `docs/workflows/` |
| Guide | Supported consumer task guidance | `docs/guide/`, `docs/consumers/`, `docs/migration/` |
| Reference | Derived catalog of APIs, components, icons, or tokens | reference/generated directories |
| Record | Point-in-time release, audit, benchmark, or readiness state | `docs/releases/evidence/`, `docs/performance/` |
| Archive | Obsolete material retained for history | `docs/archive/` |

Every new substantive document states its role, applicability, and authority
near the top; existing documents may add this metadata when revised.

## 2. Directory ownership and stable entrypoints

| Directory/file | Responsibility |
| --- | --- |
| `docs/index.md` | Navigation only |
| `docs/design.md` / `docs/design/` | Visual contract and design governance |
| `docs/architecture/` | Repository, runtime, and cross-platform architecture |
| `docs/api/` | Public and cross-platform API boundaries |
| `docs/theme/` | Token, theme, customization, and motion contracts |
| `docs/ux/` | Task and interaction semantics |
| `docs/components/` | Web/Vue component reference |
| `docs/avalonia/` | Avalonia adoption and platform differences |
| `docs/guide/` and `docs/consumers/` | Onboarding and consumer ownership |
| `docs/workflows/` | Development and maintenance workflows |
| `docs/governance/` | Governance map and policies |
| `docs/releases/` | Release policies, readiness, channels, and evidence |
| `docs/performance/` / `docs/legal/` / `docs/archive/` | Results, attribution, and history |

Stable root entrypoints include `design.md`, `index.md`, `project-overview.md`,
`engineering-handoff.md`, `visual-testing.md`, `api-stability.md`,
`element-plus-integration.md`, `element-plus-compatibility.md`, `icons.md`,
`playground.md`, and existing runtime/cross-platform reports. Do not add another
root `docs/*.md`; moving one requires updating every script, test, link, and
external reference in the same change. The forwarding-stub approach is not
sufficient when automation reads file contents.

Release material belongs under `docs/releases/`; never recreate `docs/release/`
or repository-root `release-evidence/`. `pnpm check:documentation-architecture`
enforces this boundary.

Issue bodies, execution summaries, acceptance receipts, and dated workflow
narration stay in issue or external run state. Do not create a durable document
named after an issue, ticket, date, run, actor, receipt, or verification session.
A new stable topic is allowed only when no existing authority owns it, its name
describes the durable subject, and the owning index is updated in the same
change.

## 3. Placement and duplication rules

Before creating a document, identify the existing owner, classify the content
(specification, contract, governance, workflow, guide, reference, record, or
archive), identify the product/platform owner, determine whether it is stable,
generated, temporary, or historical, and update the owning index.

State each normative rule once. Lower-authority documents link to it and explain
only their domain-specific application. Do not copy token values, geometry,
motion budgets, or design prohibitions into workflows or Skills. Examples are
non-normative unless the owning contract promotes them. Generated files name
their generator and are regenerated, not hand-edited. Records include a
baseline, date/version, and status. Deprecated active docs link to their
replacement and move to `docs/archive/` when compatibility no longer requires
them.

## 4. Change discipline

Documentation changes must not silently alter product behavior. If wording
changes a public contract, update its specification, tests, migration guidance,
and release impact. Visual or rendered changes also follow:

- [`docs/design/governance.md`](../design/governance.md)
- [`docs/design/change-classification.md`](../design/change-classification.md)
- [`docs/workflows/visual-change.md`](../workflows/visual-change.md)
- [`docs/consumers/design-integration.md`](../consumers/design-integration.md)
