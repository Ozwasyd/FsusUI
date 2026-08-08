# Visual Governance Required Gate

This page defines the required static visual-governance gate delivered for issue
[#404](https://github.com/Ozwasyd/FsusUI/issues/404). It composes the
[component-surface semantic registry](../../spec/components/component-surface-semantic-registry.json),
the [mutation corpus and scenario planner](component-semantic-corpus.md), and a
structured report into the existing quality gates without adding new visual
rules or fixing components.

## What the gate proves

`pnpm run check:visual-governance` runs, in order:

1. **Registry contract** — the canonical registry validates against its closed
   JSON Schema, every authority/implementation source digest matches the
   current checkout, every rule carries an exact component/part/selector/file
   ownership, and the production inventory (45 rules, issues #293-#310) has not
   drifted.
2. **Allowlist governance** — every allowlist entry must contain
   `ruleId`, `component`, `part`, `selector`, `file`, `reason`, `owner`,
   `testPolicy`, `reviewAfter`, and `removalCondition`. Wildcard targets,
   expired review dates, permanent removal conditions, missing test policies,
   and entries that do not resolve to an owned implementation fail closed.
   The production registry ships an empty allowlist; current violations are
   never excused through it.
3. **Mutation corpus** — every negative mutation is compiled into the final
   production CSS cascade and must be killed by its own locatable registry
   rule; every positive fixture must stay green; the run must not pollute the
   worktree.
4. **Structured report** — a report is emitted that binds one candidate
   (repository + revision) to the registry digest, per-rule digests, checker
   digests, the allowlist, every locatable violation
   (component / role / source / expected / actual), the required visual
   scenarios, and the mutation summary. Missing required visual evidence or a
   candidate identity mismatch fails the gate.

## Proof boundaries

The static gate is a source- and cascade-level proof. It can prove that:

- the canonical semantic contract is intact at the checked revision;
- deviations are either governed by an exact, dated, owner-reviewed allowlist
  entry or reported as locatable violations;
- known error families from issues #293-#310 are actually executed by the
  compiled CSS and killed by their unique rules;
- required visual scenarios and their semantic evidence expectations are
  derived from the same candidate.

The gate cannot prove and does not claim to prove:

- **Aesthetic judgment** — whether a rendered surface looks right, feels
  balanced, or matches human intent. Visual scenario execution and human
  review are separate visual-governance work.
- **Real browser rendering** — actual painted pixels, layout, compositing,
  fonts, IME, or accessibility tree behavior. Those are covered by the
  Playwright visual/geometry suites and the accessibility gate.
- **Cross-platform native behavior** — Avalonia / native control behavior is
  covered by the .NET conformance and AOT gates, not by this CSS gate.
- **Runtime interaction semantics** — focus, keyboard, pointer, motion, and
  form lifecycle contracts have their own dedicated gates
  (`check:focus-ring-contract`, `check:form-state-contract`,
  `governance:motion`, `check:anti-ai-visual`, `tokens:check`,
  `typography:check`), which this gate composes with rather than replaces.

## Wiring

- `check:visual-governance` is part of `governance:check`, which runs in the
  PR-fast suite, the full verification suite, and the reusable quality
  workflow's `static-quality` job (PR, merge queue, main, nightly, release).
  It is a required, non-`continue-on-error` step: affected source, token,
  contract, or checker changes cannot escape it.
- `test:visual-governance` runs the registry, evaluator, and corpus
  acceptance suites.

## Report

The gate writes `.tmp/visual-governance/report.json` (or the path passed via
`--output`). The report schema lives at
[`spec/components/visual-governance-report.schema.json`](../../spec/components/visual-governance-report.schema.json).
Each violation is locatable via `componentId`, `partId`, `surfaceRole`,
`selector`, `scope`, `actual.source.path`, `actual.source.line`,
`expected.canonicalReference`, and `actual.value`.
