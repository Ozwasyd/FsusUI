# Contract V2 — Platform-Neutral Component Contract

> **Role:** Normative contract between the real Web (Vue) and Avalonia public
> API baselines.
> **Applies to:** Every public component export in `spec/baselines/vue-current.json`
> and every public type in `spec/avalonia/semantic/*.json`.

Contract V2 is the explicit, platform-neutral mapping of **real baseline
members** — inputs (props), outputs (events), operations (exposed methods), and
content regions (slots) — into one machine-verifiable registry. It never
executes real interaction or visual comparison; it computes static member
coverage from the two baselines and fails the build when the mapping is not
explicit or when semantic drift is hidden.

## Artifacts

| Artifact                 | Path                                                            | Role                                                                             |
| ------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Registry                 | `spec/components/contracts/v2/contract-v2.json`                 | Generated, committed, verified                                                   |
| Gate                     | `spec/components/contracts/v2/markdown-editor-gate.json`        | MarkdownEditor blocking state                                                    |
| Semantic member bindings | `spec/components/contracts/v2/semantic-member-bindings.json`    | Explicit platform-neutral mappings for framework members whose names differ      |
| Runtime projection       | `spec/components/contracts/v2/markdown-runtime-projection.json` | Unique editor projection authority and #273/#274/#277/#278/#279 consumer exports |
| Runtime projection docs  | `docs/api/markdown-runtime-projection.md`                       | Consumer-facing runtime API                                                      |
| Interaction trace docs   | `docs/api/markdown-interaction-trace.md`                        | Real-browser Web trace schema and Contract V2 binding                            |
| Editor input             | `spec/components/contracts/v2/markdown-editor-input.json`       | Unique #327–#331 input pipeline and acceptance exports                           |
| Editor input docs        | `docs/api/markdown-editor-input.md`                             | Consumer-facing input contract                                                   |
| Generator + comparator   | `scripts/contract-v2.mjs`                                       | `generate` / `--check` / exported validators                                     |
| Mutation fixtures        | `tests/fixtures/contract-v2/`                                   | Kill-fixtures for every forbidden pattern                                        |
| Tests                    | `tests/contract-v2.test.mjs`                                    | `node --test` suite                                                              |

## Generation

```sh
pnpm run contract-v2:generate   # rebuild spec/components/contracts/v2/contract-v2.json
pnpm run contract-v2:check      # fail on drift from the committed registry
pnpm run test:contract-v2       # mutation fixture suite
pnpm run conformance:v2         # baseline through real execution and readiness
pnpm run conformance:contracts  # v1 + v2 + mutation tests + doc gates
```

The registry records SHA-256 hashes of every baseline it consumes, so any
baseline change without regeneration fails `contract-v2:check`.

The unified `conformance:v2` command reports a stable stage name driven by each
subprocess exit code. It checks the compiler-derived Web baseline, the
Roslyn-derived Avalonia semantic baseline, Contract V2 mapping and coverage
before building or launching either runtime. It then executes the real Web and
Avalonia scenarios and runs differential comparison, alignment derivation,
stable readiness, and negative mutations. A public API mutation therefore
stops at `baseline:web` or `baseline:avalonia` instead of reaching runtime with
stale evidence.

## Member mapping

Every Vue public export receives exactly one contract. Explicit platform-neutral
semantic bindings are resolved first; for example, `document` binds Web
`modelValue` to Avalonia `Document`. The generator validates both endpoints
against their independent baselines and rejects stale or duplicate mappings.
Members without an explicit mapping remain candidate-matched by name equality
after the narrow `Is/Can/Has` + `Changed` + kebab normalization, or are recorded
as gaps.
Each member carries exactly one status:

| Status              | Meaning                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `aligned-candidate` | Real member exists on both sides with no detected type/default/nullability/enum/payload drift |
| `partial`           | Real member exists on both sides but semantic drift or non-comparable typing was detected     |
| `missing`           | No real counterpart member exists on the other platform                                       |
| `web-only`          | Explicit web-only registration with governance                                                |

A member with a status other than `aligned-candidate` must carry governance
(`reason`, `owner`, `testPolicy`, `reviewPolicy`). Every required member must
carry at least one scenario coverage id.

## Comparator guarantees

- **Type drift**: CLR categories (string/boolean/number/array/function/object/date)
  are compared against Vue runtime/semantic categories; definite mismatch fails.
- **Default drift**: literal defaults are compared across platforms; mismatch fails.
- **Nullability drift**: declared nullability must agree when both sides are known.
- **Event payload drift**: payload types are compared when both sides expose them.
- **Operation signature drift**: compiler/Roslyn return and ordered parameter
  signatures are compared by the existing primitive/array categories, parameter
  count, optionality, and rest semantics. Framework or domain wrapper types are
  not guessed equivalent; an unavailable or non-comparable type keeps the member
  `partial`.
- **Enum value drift**: Vue `values` sets must intersect the Avalonia enum member
  names when both are known.
- **Scenario coverage**: a required semantic without a scenario coverage id fails.
- **Vue public coverage**: every compiler-baseline component and every semantic
  input, output, operation, and content region must appear exactly once in the
  corresponding Contract V2 section with its baseline binding and an explicit
  status. Extra, missing, duplicate, cross-kind, or misclassified web-only
  entries fail the gate.
- **Governance**: an override/omission missing any governance field fails.

## Fixed rules enforced by the validator

1. **No automatic counterpart from classification.** `portable`,
   `native-adapter`, and `platform-override` classifications never claim a
   counterpart; only real member matching can produce `aligned-candidate`.
2. **No hand-written `aligned: true`.** The registry never emits a final
   aligned claim; a mutation that injects `"aligned": true` fails.
3. **No cross-generation.** Neither baseline is derived from the other; every
   member reference points back at its own real baseline.
4. **No broad family mapping.** An override must be member-scoped; a
   family/wildcard scope fails.
5. **MarkdownEditor canonical modes.** The contract uses
   `source/live/split/preview` with the six frozen Live capability tokens
   (`supported`, `unsupported-platform`, `runtime-unavailable`,
   `projection-failed`, `feature-degraded`, `fatal`) and carries no `write`
   alias. `readonly`/`disabled` are editor props, not capability tokens.
   While `#338`–`#343` are open the gate keeps the export status at
   `partial` automatically.

The editor projection kernel is not a Vue/Avalonia component member map. It is
the unique runtime authority on
`@ozwasyd/element-plus/markdown-runtime`. Contract V2 records that authority in
`markdown-runtime-projection.json` so outline, table, search, technical, and
property consumers stay bound to the same `syn:` identities. That file does not
clear the MarkdownEditor gate.

## Avalonia-only surface

Every Avalonia public type that has no Vue counterpart is explicitly registered
in `avaloniaOnlyTypes` with governance and scenario coverage. Extra members of
mapped components are registered per contract in `avaloniaExtras`.
