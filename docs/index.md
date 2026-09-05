# FsusUI Documentation

FsusUI is a cross-platform Vue 3 component system built on the Element Plus
compatibility surface. The current npm public-preview package is
`@ozwasyd/element-plus`. This page is navigation only; design, API, and
verification rules remain owned by their domain documents.

## Start with a task

| Task | Start here | Then read |
| --- | --- | --- |
| Install and use Web/Vue | [Quickstart](./guide/quickstart.md) | [Installation](./guide/installation.md), [Theme](./guide/theming.md), [Components](./components/overview.md) |
| Change visual or interaction behavior | [Design map](./design/README.md) | [Design contract](./design.md), [Change classification](./design/change-classification.md), [Visual workflow](./workflows/visual-change.md) |
| Consume FsusUI from a product | [Consumer docs](./consumers/README.md) | [Design integration](./consumers/design-integration.md), [FsusBlog examples](./ux/fsusblog-consumption-examples.md) |
| Change tokens, motion, or theme | [Theme tokens](./theme/tokens.md) | [Token spec](../spec/tokens/README.md), [Motion](./theme/motion.md), [Customization](./theme/customization.md) |
| Change a Web/Vue component | [Component overview](./components/overview.md) | The component page, [API stability](./api-stability.md), [Visual testing](./visual-testing.md) |
| Change Avalonia/.NET | [Avalonia docs](./avalonia/README.md) | [Platform differences](./avalonia/platform-differences.md), [Vue migration](./avalonia/vue-migration.md) |
| Understand repository structure | [Architecture](./architecture/README.md) | [Project overview](./project-overview.md), [Architecture spec](../spec/architecture.md) |
| Maintain, verify, or release | [Workflows](./workflows/README.md) | [Engineering handoff](./engineering-handoff.md), [Governance](./governance/README.md), [Release docs](./releases/README.md) |

## Documentation authority

1. [`spec/`](../spec/README.md): platform-neutral, machine-validated contracts.
2. [`docs/design.md`](./design.md): the sole human-readable visual contract.
3. API, theme, UX, component, and Avalonia domain contracts.
4. Governance and workflow documents: how to classify, change, and verify; they
   do not redefine design values.
5. Guides, consumer docs, and examples: how to adopt the public contracts.
6. Generated output, release evidence, benchmarks, audits, and archives:
   derived output or point-in-time records.

See [Documentation Architecture](./governance/documentation-architecture.md)
for document roles, directory ownership, and placement rules.

## Domains

| Domain | Entry | Covers |
| --- | --- | --- |
| Design system | [docs/design/](./design/README.md) | Design contract, change routing, UX, and visual evidence |
| Platform-neutral specification | [spec/](../spec/README.md) | Tokens, component, interaction, accessibility, motion, and platform overrides |
| Architecture | [docs/architecture/](./architecture/README.md) | Monorepo, runtime, cross-platform, and API boundaries |
| Web/Vue components | [Component overview](./components/overview.md) | API, state, keyboard behavior, tokens, and limits |
| Avalonia | [Avalonia adoption](./avalonia/README.md) | .NET packages, controls, platform differences, and migration |
| Consumers | [docs/consumers/](./consumers/README.md) | Ownership, integration, and product examples |
| Guides | [docs/guide/](./guide/quickstart.md) | Installation, theme, dark mode, i18n, SSR, namespace, and defaults |
| Workflows and governance | [Workflows](./workflows/README.md) | Maintenance, testing, demo, compatibility, and release execution |
| Migration and compatibility | [Element Plus compatibility](./element-plus-compatibility.md) | Package, import, and support boundaries |
| Versions and evidence | [Release docs](./releases/README.md) | Readiness, performance, audit, and release evidence |

## Stable top-level entries

The following root paths are referenced by scripts, tests, contribution docs, or
external links and therefore remain stable:

- [Design contract](./design.md)
- [Project overview](./project-overview.md)
- [Engineering handoff](./engineering-handoff.md)
- [Visual test profiles](./visual-testing.md)
- [API stability](./api-stability.md)
- [Element Plus integration](./element-plus-integration.md)
- [Element Plus compatibility](./element-plus-compatibility.md)
- [Icon system](./icons.md)
- [Playground / Demo](./playground.md)

New documents should be placed in their domain rather than added to `docs/`.

## Key public documents

- [Contribution guide](../CONTRIBUTING.md)
- [Security policy](../SECURITY.md)
- [Code of Conduct](../CODE_OF_CONDUCT.md)
- [License and attribution](./legal/element-plus-attribution.md)
- [Element Plus migration](./migration/from-element-plus.md)
- [Release docs and evidence](./releases/README.md)

FsusUI is the public-facing name for this fork and compatibility-focused Vue 3
component library. Element Plus remains the upstream provenance and
API-alignment context; `@ozwasyd/element-plus` is the FsusUI compatibility build,
not the upstream package.
