# Design Governance

> **Role:** Normative design governance
> **Applies to:** FsusUI core, Web/Vue and Avalonia implementations, documentation examples, and FsusUI-consuming applications
> **Authority:** Interprets [`docs/design.md`](../design.md) and [`spec/`](../../spec/README.md). It cannot change their visual intent or canonical values.

This document constrains how design rules are read, changed, and applied. Its purpose is to prevent implementation convenience, model defaults, consumer-specific preferences, or isolated screenshots from becoming a second FsusUI design language.

## 1. Normative language

The following terms are normative:

- **MUST / 必须**: required for conformance.
- **MUST NOT / 不得**: prohibited; do not bypass through aliases, wrapper components, selector exceptions, or consumer patches.
- **SHOULD / 应**: the default. A deviation requires a specific, reviewable reason and evidence.
- **SHOULD NOT / 不应**: avoid unless a documented constraint makes the alternative materially worse.
- **MAY / 可以**: permitted only when higher-priority rules remain satisfied.

Examples explain a rule. They do not automatically authorize the same styling in another component or surface.

## 2. Rule precedence

When two instructions appear to conflict, resolve them in this order:

1. Security and accessibility requirements.
2. Platform-neutral specification and canonical token source.
3. Explicit prohibitions in `docs/design.md`.
4. Component- or surface-specific design rules.
5. General design principles in `docs/design.md`.
6. Public API and compatibility contracts.
7. Existing approved implementation and visual baselines.
8. Workflow documents, examples, framework defaults, common UI patterns, or implementer preference.

A lower-priority source cannot override a higher-priority source. “More modern”, “more polished”, “more consistent with SaaS”, framework defaults, or model preference are not valid override reasons.

## 3. Preservation default

Unless the task explicitly authorizes a change, preserve:

- information architecture and content order;
- the number and priority of actions;
- the primary visual focus;
- component semantics and ownership;
- existing public behavior and accessibility;
- the distinction between task, reading, public, and marketing surfaces.

Do not add helper copy, badges, icons, cards, decorative surfaces, calls to action, illustrations, motion, or new states to make a result look more complete. When evidence is incomplete, prefer the smallest coherent change over speculative redesign.

## 4. Classify before implementing

Before selecting a component, token, layout pattern, or visual treatment, classify the change using [`change-classification.md`](./change-classification.md):

- owner: FsusUI specification, FsusUI implementation, platform override, or consumer;
- surface: task, reading, public, marketing, overlay, data-region, control-group, navigation, or expressive;
- contract type: token, component, interaction, accessibility, content, layout, example, or workflow;
- impact: local, shared component, global theme, cross-platform, or consumer-only.

The desired CSS effect must not determine the classification. For example, a panel cannot be labeled `expressive` merely to obtain a larger radius, and a consumer composition problem cannot be moved into FsusUI merely to avoid changing consumer code.

## 5. Single-source rule

- Canonical values belong in `spec/` and generated outputs.
- Human-readable visual intent belongs in `docs/design.md`.
- Domain-specific public behavior belongs in the nearest API, theme, UX, component, or platform contract.
- Workflows and Skills may reference these rules but must not repeat their values.
- Consumer-specific composition, routing, copy, and product workflow remain in the consumer repository.

If a new document repeats an existing normative rule, replace the repetition with a link and domain-specific application notes.

## 6. Exceptions

An exception is allowed only when the existing contract explicitly provides an exception mechanism, such as a registered platform override, opt-in material, or expressive surface.

Every new exception MUST record:

- semantic reason;
- exact scope;
- owner;
- affected platforms and states;
- test and visual-evidence policy;
- consumer impact;
- review or removal condition;
- `reviewAfter` when the relevant registry supports it.

The following are not acceptable reasons:

- aesthetic preference without a product requirement;
- similarity to a popular product or template;
- “AI generated” completeness;
- framework or component-library default behavior;
- avoiding a proper fix in FsusUI or the consumer;
- making a single screenshot pass.

Do not weaken an existing checker, baseline, or contract to admit an undocumented exception.

## 7. Changing the design contract

A change to FsusUI visual intent is not a normal implementation detail. It requires all applicable steps:

1. State the design problem and affected surfaces.
2. Identify the current rule and why it is insufficient.
3. Confirm that the change belongs to FsusUI rather than one consumer.
4. Update or add the canonical token/contract first when values or semantics change.
5. Update `docs/design.md` and the nearest domain contract.
6. Update Web and Avalonia mappings or register an explicit platform difference.
7. Add interaction, accessibility, visual, migration, and consumer evidence as applicable.
8. Record public API or release impact.

A local stylesheet change must not silently establish a new design rule.

## 8. Conformance versus visual acceptance

Passing static checks proves only the rules those checks encode. It does not by itself prove:

- correct information hierarchy;
- an appropriate number of focal points;
- good optical alignment;
- suitable density or whitespace rhythm;
- correct behavior with realistic long, short, empty, loading, and error content;
- a newly introduced state that has no fixture.

Visual acceptance requires inspected rendered evidence for the affected states and viewports. A zero-diff result is not evidence for an untested state. See [`docs/workflows/visual-change.md`](../workflows/visual-change.md).

## 9. Consumer interpretation

Consumers inherit FsusUI public component and token contracts, not every task-surface page composition. Public, marketing, editorial, and product-specific layouts must define their own rules without overriding FsusUI internals. See [`docs/consumers/design-integration.md`](../consumers/design-integration.md).
