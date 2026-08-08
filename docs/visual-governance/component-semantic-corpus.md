# Component Semantic Negative Corpus and Required Visual Scenario Planner

This page describes the mutation corpus and visual scenario planner delivered for issue
[#403](https://github.com/Ozwasyd/FsusUI/issues/403). It is a follow-up to the
[component-surface semantic registry](../../spec/components/component-surface-semantic-registry.json)
and the [#402](https://github.com/Ozwasyd/FsusUI/issues/402) semantic rule gate: it proves that
each known error family from issues #293-#310 is actually executed against the compiled final
CSS and is killed by a unique, locatable registry rule.

## What the corpus proves

Every corpus case is a CSS mutation of the production theme. The runner:

1. compiles the real production theme (`vue/packages/theme-chalk/src/index.scss`) into a
   temporary, isolated fixture;
2. injects exactly one mutation into a separate candidate entrypoint;
3. runs the production semantic evaluator against that candidate;
4. requires at least one `fail` diagnostic whose `ruleId` is the mutation's own registry rule
   and whose `actual.source.path` is the mutation file.

The mutation only counts as killed when it actually wins the compiled cascade and changes the
semantic value. Checking fixture existence, or running the checker without compiling the final
CSS, is not enough: both are detected as "not killed".

## Positive fixtures

The corpus also carries positive control fixtures that use canonical aliases or canonical
values (for example `var(--fsus-select-option-height)` for the option row, or the canonical
table header type scale). A positive fixture must stay green: no `fail` diagnostic may
originate from the fixture file. This guards against a checker that false-positives compliant
implementations.

The unmutated production theme is evaluated as the baseline. It is intentionally not asserted
to be fail-free: the registry exists to detect the current violations without exceptions. The
corpus asserts only that baseline failures never originate from corpus fixtures and that the
run does not pollute the worktree.

## Visual scenario planner

For every `staticUnknown` emitted by the evaluator, the planner generates a blocking visual
scenario that is bound to:

- `scenarioId` derived from the canonical rule id and its visual requirement id;
- `componentId`, `partId`, `ruleId`, `selector` and `scope`;
- the required `states`, `themes`, `viewports`, `zooms` and `inputs`;
- `expectedSemanticEvidence` copied verbatim from the registry;
- `candidateIdentity` (`repository` + `revision`) captured at run time;
- concrete `renderRequirements`.

Render requirements are derived deterministically from the canonical rule:

| Requirement                 | Trigger                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `card-stack`                | overlay/panel/card surface roles or `surfaceCardMotif` constraint |
| `motif-repetition`          | `surfaceCardMotif` visual probe field or constraint               |
| `focus-selected-layering`   | state-color constraint or a selected/checked/current selector     |
| `range-continuity`          | date-picker components                                            |
| `semantic-evidence-capture` | every rule (capture evidence, never auto-score aesthetics)        |

The planner does not claim to judge aesthetics. It emits render requirements and evidence
expectations; execution and review remain visual-governance work.

## Layout

- `tests/fixtures/component-semantic-rules/corpus.json` - corpus manifest (cases, positive
  fixtures, issue coverage).
- `tests/fixtures/component-semantic-rules/mutations/` - negative mutations and positive
  controls, each declaring `fsus-rule-id`.
- `scripts/check-component-semantic-corpus.mjs` - isolated runner + planner (CLI and library).
- `tests/component-semantic-corpus.test.mjs` - acceptance tests (`CSC-403-*`).

## Running

```sh
node scripts/check-component-semantic-corpus.mjs
node --test tests/component-semantic-corpus.test.mjs
```

The runner exits non-zero when any negative mutation is not killed, any positive fixture is
killed, coverage is incomplete, or the worktree changed during the run.
