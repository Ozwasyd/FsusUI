---
name: fsusui-design-conformance
description: Use for implementing, reviewing, or documenting visual, UX, theme, token, motion, icon, component, responsive-layout, or rendered-output changes in FsusUI itself or in a repository that imports, aliases, wraps, or embeds FsusUI. Do not use for generic UI work, backend-only changes, or products that do not consume FsusUI.
---

# FsusUI Design Conformance Workflow

Use this Skill only when the change belongs to FsusUI or a confirmed FsusUI consumer. Its job is to route work through the repository’s design contracts and evidence workflow. It must not create, summarize into, or replace the design system.

## 1. Confirm scope

Confirm one of these conditions before proceeding:

- the current repository is FsusUI;
- the current repository imports FsusUI through a package, workspace, alias, linked checkout, or embedded source;
- the task explicitly reviews a consumer against a known FsusUI baseline.

Otherwise, do not use this Skill.

For a consumer, locate the exact FsusUI package version, revision, alias target, or linked checkout. Do not assume the consumer’s local copies of token values or design notes are authoritative.

## 2. Load the authoritative documents

Read, in order:

1. `docs/index.md`
2. `docs/design.md`
3. `docs/design/governance.md`
4. `docs/design/change-classification.md`
5. `docs/workflows/visual-change.md`
6. `docs/consumers/design-integration.md` when a consumer is involved
7. the nearest component, theme, UX, API, accessibility, motion, or platform contract

When working in a consumer repository, read these files from the linked FsusUI source or exact dependency baseline when available. Do not copy their values into the consumer or this Skill.

If this Skill conflicts with `spec/`, `docs/design.md`, or a public domain contract, the authoritative document wins. Correct the Skill or lower-authority document rather than reinterpret the design contract.

## 3. Classify before editing

State:

- whether the owner is FsusUI specification, FsusUI Web/Vue, FsusUI Avalonia, a registered platform override, or the consumer;
- the surface and semantic role;
- the contracts and states affected;
- the exact allowed scope and out-of-scope adjacent areas;
- whether the task restores conformance or proposes a design-contract change.

Do not choose a classification to obtain a desired visual effect. Do not classify an ordinary surface as expressive or glass, and do not move consumer composition into FsusUI.

## 4. Preserve design intent

Unless explicitly authorized by the authoritative documents and task:

- preserve information architecture, content order, and action priority;
- preserve the existing primary visual focus;
- do not add cards, surfaces, badges, icons, helper copy, illustrations, calls to action, motion, or decorative effects;
- do not redesign adjacent components;
- do not create new tokens, wrappers, variants, or exceptions;
- do not use generic SaaS patterns, framework defaults, trends, or model preference as design evidence.

Prefer the smallest coherent fix that restores the documented contract.

## 5. Respect FsusUI and consumer ownership

When the public FsusUI primitive is defective, fix FsusUI and its tests. Do not add a compatibility layer, private selector override, fake `--fsus-*` token, or local component fork in the consumer.

When the issue is route composition, product copy, business workflow, public/marketing/editorial layout, or selection among valid variants, keep the change in the consumer. Do not change FsusUI defaults for one consumer.

## 6. Implement and synchronize evidence

Follow `docs/workflows/visual-change.md`:

- inspect the existing rendered state when possible;
- use canonical sources and public APIs;
- update implementation, focused tests, fixtures, and nearest documentation together;
- run repository-defined affected checks and visual profiles;
- inspect the rendered evidence across applicable states, themes, viewports, locales, zoom, focus, overflow, and reduced motion;
- do not weaken a checker, threshold, contract, or snapshot to make the result pass.

A passing compile, unit test, static checker, or zero-diff screenshot command is not sufficient for an untested state.

## 7. Completion report

Report:

1. FsusUI baseline and ownership classification;
2. authoritative documents and sections applied;
3. files changed and contracts affected;
4. validation commands and exact results;
5. rendered states and evidence inspected;
6. remaining uncertainty;
7. confirmation that the change did not create a parallel design system, consumer compatibility layer, or undocumented exception.

Do not claim visual acceptance without inspected rendered evidence.
