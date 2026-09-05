# Visual Governance Required Gate

This page defines the required static visual-governance gate delivered for [#404](https://github.com/Ozwasyd/FsusUI/issues/404). It combines the [component-surface semantic registry](../../spec/components/component-surface-semantic-registry.json), the [mutation corpus and scenario planner](component-semantic-corpus.md), and a structured report with existing quality gates without adding visual rules or fixing components.

## What the gate proves

`pnpm run check:visual-governance` runs these checks in order:

1. **Registry contract** — The closed JSON Schema validates; every authority/implementation source digest matches the current checkout; every rule has exact component/part/selector/file ownership; and the production inventory (45 rules, issues #293-#310) has not drifted.
2. **Allowlist governance** — Every allowlist entry must contain `ruleId`, `component`, `part`, `selector`, `file`, `reason`, `owner`, `testPolicy`, `reviewAfter`, and `removalCondition`. Wildcard targets, expired review dates, permanent removal conditions, missing test policies, and unowned implementations fail closed. The production registry has an empty allowlist; current violations are never excused through it.
3. **Mutation corpus** — Each negative mutation is compiled into the final production CSS cascade and must be killed by its locatable registry rule; each positive fixture must stay green; the run must not pollute the worktree.
4. **Structured report** — The report binds one candidate (repository + revision) to the registry digest, per-rule/checker digests, allowlist, every locatable violation (component / role / source / expected / actual), required visual scenarios, and mutation summary. Missing required visual evidence or a candidate identity mismatch fails the gate.

## Proof boundaries

The static gate is a source- and cascade-level proof. It proves that:

- the canonical semantic contract is intact at the checked revision;
- deviations are either governed by an exact, dated, owner-reviewed allowlist entry or reported as locatable violations;
- issues #293-#310 error families execute against compiled CSS and are killed by their unique rules;
- required visual scenarios and evidence expectations derive from the same candidate.

The gate cannot prove and does not claim to prove:

- **Aesthetic judgment** — whether a rendered surface looks right, feels balanced, or matches human intent. Scenario execution and human review remain separate visual-governance work.
- **Real browser rendering** — painted pixels, layout, compositing, fonts, IME, or accessibility-tree behavior. Use the Playwright visual/geometry suites and accessibility gate.
- **Cross-platform native behavior** — Avalonia/native behavior belongs to the .NET conformance and AOT gates.
- **Runtime interaction semantics** — focus, keyboard, pointer, motion, and form lifecycle use dedicated gates (`check:focus-ring-contract`, `check:form-state-contract`, `governance:motion`, `check:anti-ai-visual`, `tokens:check`, `typography:check`), which this gate composes with rather than replaces.

## Wiring

- `check:visual-governance` is part of `governance:check`, the PR-fast and full verification suites, and the reusable quality workflow's `static-quality` job (PR, merge queue, main, nightly, release). It is required and non-`continue-on-error`; affected source, token, contract, or checker changes cannot bypass it.
- `test:visual-governance` runs the registry, evaluator, and corpus acceptance suites.

## Report

The gate writes `.tmp/visual-governance/report.json` (or `--output`). Its schema is [`spec/components/visual-governance-report.schema.json`](../../spec/components/visual-governance-report.schema.json). Each violation is locatable by `componentId`, `partId`, `surfaceRole`, `selector`, `scope`, `actual.source.path`, `actual.source.line`, `expected.canonicalReference`, and `actual.value`.
