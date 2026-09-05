# Component Semantic Negative Corpus and Required Visual Scenario Planner

This page documents the mutation corpus and visual scenario planner delivered for [#403](https://github.com/Ozwasyd/FsusUI/issues/403). It follows the [component-surface semantic registry](../../spec/components/component-surface-semantic-registry.json) and [#402](https://github.com/Ozwasyd/FsusUI/issues/402) semantic rule gate. Together they execute each known error family from issues #293-#310 against compiled final CSS and require a unique, locatable registry rule to kill it.

## What the corpus proves

Every case is a CSS mutation of the real production theme. The runner:

1. Compiles the real theme (`vue/packages/theme-chalk/src/index.scss`) into a temporary isolated fixture.
2. Injects exactly one mutation into a separate candidate entrypoint.
3. Runs the production semantic evaluator against that candidate.
4. Requires at least one `fail` diagnostic whose `ruleId` is the mutation's own registry rule and whose `actual.source.path` is the mutation file.

A mutation is killed only when it wins the compiled cascade and changes the semantic value. Fixture existence or a checker run without final-CSS compilation is insufficient; both are reported as “not killed”.

## Positive fixtures

Positive controls use canonical aliases or values (for example, `var(--fsus-select-option-height)` for an option row and the canonical table-header type scale). They must stay green: no `fail` diagnostic may originate from a fixture file. This prevents false positives against compliant implementations.

The unmutated production theme is the baseline and is intentionally not required to be fail-free: the registry detects current violations without exceptions. The corpus requires only that baseline failures never originate from corpus fixtures and that the run does not pollute the worktree.

## Visual scenario planner

For each `staticUnknown` emitted by the evaluator, the planner creates a blocking visual scenario bound to:

- `scenarioId` derived from the canonical rule and visual-requirement ids;
- `componentId`, `partId`, `ruleId`, `selector`, and `scope`;
- required `states`, `themes`, `viewports`, `zooms`, and `inputs`;
- `expectedSemanticEvidence` copied verbatim from the registry;
- runtime `candidateIdentity` (`repository` + `revision`);
- concrete `renderRequirements`.

Render requirements are deterministic:

| Requirement | Trigger |
| --- | --- |
| `card-stack` | Overlay/panel/card surface roles or a `surfaceCardMotif` constraint |
| `motif-repetition` | `surfaceCardMotif` visual-probe field or constraint |
| `focus-selected-layering` | State-color constraint or selected/checked/current selector |
| `range-continuity` | Date-picker component |
| `semantic-evidence-capture` | Every rule; capture evidence, never auto-score aesthetics |

The planner emits requirements and evidence expectations; it does not judge aesthetics. Scenario execution and review remain visual-governance work.

## Layout

| Path | Contents |
| --- | --- |
| `tests/fixtures/component-semantic-rules/corpus.json` | Corpus manifest, positive fixtures, and issue coverage |
| `tests/fixtures/component-semantic-rules/mutations/` | Negative mutations and positive controls declaring `fsus-rule-id` |
| `scripts/check-component-semantic-corpus.mjs` | Isolated runner and planner (CLI and library) |
| `tests/component-semantic-corpus.test.mjs` | Acceptance tests (`CSC-403-*`) |

## Running

```sh
node scripts/check-component-semantic-corpus.mjs
node --test tests/component-semantic-corpus.test.mjs
```

The runner exits non-zero if a negative mutation is not killed, a positive fixture is killed, coverage is incomplete, or the worktree changes during the run.
