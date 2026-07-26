# Design Documentation

> **Role:** Navigation
> **Applies to:** FsusUI and applications that consume FsusUI

FsusUI has one human-readable visual source of truth: [`docs/design.md`](../design.md). Files in this directory govern how that contract is interpreted and changed; they must not create alternative token values, component defaults, or visual styles.

## Core contract

- [The Intellectual Minimalist design contract](../design.md)
- [Canonical token specification](../../spec/tokens/README.md)
- [Theme token contract](../theme/tokens.md)
- [Motion contract](../theme/motion.md)
- [Typography baseline](../../spec/typography/baseline.json)

## Governance and change routing

- [Design governance](./governance.md)
- [Design change classification](./change-classification.md)
- [Consumer design integration](../consumers/design-integration.md)
- [Visual change workflow](../workflows/visual-change.md)

## UX and component application

- [Don’t Make Me Think UX guidelines](../ux/dont-make-me-think-guidelines.md)
- [Task-oriented component semantics](../ux/task-oriented-components.md)
- [Web/Vue component overview](../components/overview.md)
- [Avalonia adoption](../avalonia/README.md)

## Interpretation rule

If a governance, workflow, guide, example, or Skill conflicts with `docs/design.md` or `spec/`, the higher-authority source wins. Correct the lower-authority document rather than weakening the design contract.
