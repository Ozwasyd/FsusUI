# Development Workflows

> **Role:** Navigation
> **Applies to:** FsusUI maintainers, contributors, automation, and consumer integration work

Workflow documents describe repeatable execution and evidence. They must reference, not duplicate, the rules in `spec/`, `docs/design.md`, and domain contracts.

## Implementation and maintenance

- [Engineering handoff](../engineering-handoff.md)
- [Visual change workflow](./visual-change.md)
- [Native CJK IME acceptance](./native-ime.md)
- [Visual testing profiles](../visual-testing.md)
- [Playground and Demo](../playground.md)
- [Contributing](../../CONTRIBUTING.md)

## Quality and release

- [CI readiness](../ci-readiness.md)
- [Release governance](../releases/governance.md)
- [Cross-platform release policy](../releases/policy/cross-platform.md)
- [Performance benchmarks](../performance/real-render-benchmarks.md)

## Reusable agent workflow

The repository-local Skill at
[`.agents/skills/fsusui-design-conformance/SKILL.md`](../../.agents/skills/fsusui-design-conformance/SKILL.md)
encodes the visual-change routing workflow for FsusUI and repositories that consume FsusUI. The Skill is procedural; it does not contain design values or replace the documentation sources of truth.
