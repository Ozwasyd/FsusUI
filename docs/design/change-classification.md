# Design Change Classification

> **Role:** Normative change-routing contract
> **Applies to:** FsusUI implementation and documentation changes, plus downstream applications that consume FsusUI
> **Authority:** Applies [`docs/design.md`](../design.md), [`docs/design/governance.md`](./governance.md), and [`spec/`](../../spec/README.md).

Classify a change before implementation. The classification determines ownership, allowed sources, required documentation, and evidence. Do not choose a category because it makes the intended CSS or code easier.

## 1. Ownership classes

| Class | Owns | Does not own | Primary sources |
| --- | --- | --- | --- |
| Canonical specification | Token names and values, component states, platform-neutral semantics, accessibility, motion, allowed platform differences | Vue selectors, XAML details, product workflows | `spec/` |
| FsusUI design contract | Visual intent, surface taxonomy, typography, density, material, component defaults | Consumer-specific page composition | `docs/design.md`, `docs/design/` |
| Web/Vue implementation | Vue behavior, Element Plus compatibility, DOM and theme integration | Cross-platform truth or consumer business logic | `vue/`, `docs/components/`, `docs/theme/` |
| Avalonia implementation | XAML themes, .NET controls, Avalonia platform behavior | Web DOM assumptions | `dotnet/`, `docs/avalonia/` |
| Platform override | A necessary, bounded difference that cannot be eliminated | Convenience divergence or unregistered design preference | `spec/platform-overrides/` |
| Consumer integration | Product routing, business copy, information architecture, page composition, product-specific public/marketing/reading rules | FsusUI internals or new `--fsus-*` truth | consumer repository, `docs/consumers/` |
| Example or record | Demonstrates usage or records evidence | New normative behavior | examples, Demo, `docs/releases/evidence/`, audit reports |

## 2. Surface classification

| Surface | Typical content | Default design owner | Required caution |
| --- | --- | --- | --- |
| Task | Forms, settings, moderation, editing, administration | FsusUI components plus consumer composition | Use task density and stable action hierarchy |
| Reading | Long-form text, article body, documentation prose | Consumer layout plus FsusUI typography primitives | Do not import admin panel/card patterns |
| Public | Public navigation, article listing, account entry, public shell | Shared primitives plus consumer layout rules | Define responsive navigation and content hierarchy in the consumer |
| Marketing | Hero, campaign, pricing, promotional CTA | Consumer | FsusUI does not supply a complete marketing language |
| Document | Page headers, results, statistics, summaries | FsusUI | Flat by default; do not manufacture a card |
| Control group | Toolbar, segmented control, grouped inputs | FsusUI | Enclose only a real interaction group |
| Data region | Table, calendar, transfer, structured comparison | FsusUI | Region may have a border; rows stay flat |
| Overlay | Dialog, drawer, popover, dropdown, tooltip | FsusUI | Use overlay contracts; do not turn page content into overlays |
| Navigation | Menu, tabs, public shell navigation | Shared | Mobile mode must be explicit and semantically correct |
| Expressive | Explicit opt-in visual surface | Explicit owner and contract | Never classify ordinary content as expressive to gain styling |

## 3. Impact classes and required updates

| Change | Update or inspect | Minimum evidence |
| --- | --- | --- |
| Canonical token value or alias | `spec/tokens/tokens.json`, generated outputs, token docs, `docs/design.md` mapping, Web/Avalonia consumers | token checks, conformance, affected visual evidence, migration/release impact |
| Component public behavior or state | component source, component docs, platform-neutral contract where applicable, focused tests | unit/interaction/a11y tests and affected visual evidence |
| Component default visual output | `docs/design.md` section, theme/component source, component docs, fixtures | anti-AI/design checks and affected visual evidence across relevant states |
| Motion behavior | motion spec/docs, reduced-motion behavior, state-machine tests | motion, SSR, reduced-motion, and affected visual evidence |
| Typography or foundation style | canonical typography/foundation sources and all affected surfaces | full-required visual plan and readable-content inspection |
| New or changed UX pattern | `spec/patterns/`, `docs/ux/`, implementation or example, semantic checker | realistic task example and interaction/accessibility evidence |
| Public/marketing/reading layout in a consumer | consumer design rules, consumer components and fixtures | consumer viewport/theme/content matrix; no FsusUI internal patch |
| FsusUI defect exposed by a consumer | fix the owning FsusUI source and tests | FsusUI regression evidence plus consumer confirmation |
| Platform-only difference | registered override with reason, owner, test policy, review condition | platform-specific conformance and comparison evidence |
| Documentation example only | nearest guide/example and links to normative sources | syntax or example validation; no claim of contract change |

## 4. FsusUI versus consumer decision

A change belongs to FsusUI when it corrects or extends a reusable public component, token, interaction, accessibility behavior, or documented primitive for multiple consumers.

A change belongs to the consumer when it concerns:

- route-level composition;
- product-specific content priority;
- business copy or workflow;
- public/marketing/editorial layout;
- selection among documented FsusUI variants;
- consumer-owned `--{consumer}-*` tokens that map to public FsusUI tokens.

Do not add a compatibility layer in the consumer to mask an FsusUI defect. Do not generalize one consumer’s page composition into FsusUI without evidence of a reusable primitive.

## 5. Ambiguity rule

When classification remains ambiguous:

1. preserve current behavior;
2. isolate the smallest change;
3. document the uncertainty;
4. do not introduce a new token, surface role, wrapper, or exception;
5. seek evidence from an existing contract, component, fixture, or multiple consumers.

Ambiguity is not permission to redesign.
