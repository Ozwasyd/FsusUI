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
| Gate                     | `spec/components/contracts/v2/markdown-editor-gate.json`        | Audited MarkdownEditor issue-blocking state                                      |
| Semantic member bindings | `spec/components/contracts/v2/semantic-member-bindings.json`    | Exact platform-neutral mappings and reviewed member-level Web-only dispositions  |
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
Each Avalonia semantic baseline also self-verifies its compiler input tree,
compiler options, dependency versions, Contract V2 schema, and semantic payload.
Its `outputHash` is computed from the canonical baseline with only
`source.outputHash` replaced by the empty string; changing a semantic member
without regenerating the baseline therefore fails before mapping.
The compiler baseline retains declared generic parameter constraints and public
`ICommand` properties. Command entries carry their exact nullable/read/write
surface and merge any CLR, Styled, or Direct property registration metadata;
unknown invocation parameters or `CanExecute` behavior are not inferred.

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
as gaps. A member-level Web-only disposition must name one real compiler
baseline member and record its owner, test policy, review policy, reason, and
native alternative. Wildcards, unknown members, duplicate dispositions, and
collisions with a semantic mapping are rejected.
Each member carries exactly one status:

| Status              | Meaning                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `aligned-candidate` | Real member exists on both sides with no detected type/default/required/access/nullability/enum/payload drift |
| `partial`           | Real member exists on both sides but semantic drift or non-comparable typing was detected                     |
| `missing`           | No real counterpart member exists on the other platform                                                       |
| `web-only`          | Explicit web-only registration with governance                                                                |

A member with a status other than `aligned-candidate` must carry governance
(`reason`, `owner`, `testPolicy`, `reviewPolicy`). Every required member must
declare at least one scenario id. A declared id is a coverage requirement, not
evidence that the scenario ran.

## Comparator guarantees

- **Type drift**: CLR categories (string/boolean/number/array/function/object/date)
  are compared against Vue runtime/semantic categories; definite mismatch fails.
- **Default drift**: literal defaults are compared only when compiled metadata
  makes both values known. Missing Avalonia metadata and non-literal Vue
  defaults remain `partial`.
- **Required drift**: Vue required metadata is compared only with an explicit
  compiled Avalonia required marker; absence on either side remains `partial`.
- **Read/write drift**: Vue readonly metadata is compared with the real CLR
  `CanRead`/`CanWrite` surface. Unknown access, an unreadable property, or a
  readonly/write mismatch remains `partial`.
- **Nullability drift**: declared nullability must agree. Missing metadata on
  either side remains `partial`.
- **Event payload drift**: explicitly bound Vue outputs use the TypeScript
  checker to retain their shallow source-interface fields (bounded to 64),
  optionality, and nullability. The comparator checks those fields against
  Roslyn EventArgs properties. A single EventArgs property is unwrapped only
  when its name matches the single Vue payload parameter and both shapes are
  available. Recursive, framework, unresolved, multi-parameter, and rest
  payloads remain `partial`; wrapper type names are never guessed equivalent.
- **Operation signature drift**: explicitly bound Vue operations use the
  TypeScript checker to retain inferred return and ordered parameter signatures,
  which are compared with Roslyn signatures by the existing primitive/array
  categories, parameter count, optionality, and rest semantics. Non-callable or
  unresolved exposed values and framework or domain wrapper types are not
  guessed equivalent; they remain `partial`.
- **Content-region drift**: Vue slot outlets come from the Vue SFC compiler AST,
  including static versus dynamic names, scoped payload field names, and whether
  a spread/dynamic binding makes the payload incomplete. Avalonia content
  regions come from Roslyn-confirmed property-level `ContentAttribute` metadata
  with their CLR/Styled kind, type, nullability, and read/write surface. Only an
  explicit member-scoped semantic binding may pair the two. Dynamic names,
  unknown content types, incomplete payloads, or scoped payloads without a
  compiler-proven Avalonia shape remain `partial`; a `ContentProperty` is never
  broadly applied to every Vue slot.
- **Enum value drift**: Vue `values` sets must intersect the Avalonia enum member
  names when both are known.
- **Scenario declaration**: a required semantic without a scenario id fails.
- **Executed member coverage**: Web and Avalonia runners record only members
  observed through successful real steps or emitted events. The comparator
  intersects those records and seals the ledger against the exact
  candidate/contract/baseline/scenario identity and both evidence digests.
  Derivation validates every ledger key against the Contract V2 member and its
  declared scenario id. Missing executed coverage remains an explicit gap and
  prevents an otherwise complete contract from becoming `aligned`; forged,
  metadata-only, stale, duplicate, or unknown records fail closed.
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
   The completed `#338`–`#343` and `#288` dependency chain leaves the issue
   gate inactive with an empty `blockedBy` list. An inactive gate cannot force
   an export status: MarkdownEditor remains `partial` while its real static
   member mapping or execution evidence is incomplete. The validator rejects
   stale blocker numbers on an inactive gate and any generated status that
   disagrees with this automatic derivation.

The editor projection kernel is not a Vue/Avalonia component member map. It is
the unique runtime authority on
`@ozwasyd/element-plus/markdown-runtime`. Contract V2 records that authority in
`markdown-runtime-projection.json` so outline, table, search, technical, and
property consumers stay bound to the same `syn:` identities. That file does not
determine the MarkdownEditor alignment status.

## Avalonia-only surface

Every Avalonia public type that has no Vue counterpart is explicitly registered
in `avaloniaOnlyTypes` with governance and scenario coverage. Extra members of
mapped components are registered per contract in `avaloniaExtras`.

The generator derives a canonical identity from the Roslyn semantic baseline
for each CLR property (including its Styled/Direct property metadata), command,
event, method overload, and enum member. An `ICommand` remains in the baseline
property inventory, but its Contract V2 public surface is represented once as a
command with the merged property registration facts. Command operations resolve
only through an explicit semantic binding; without compiler-proven invocation
parameters and `CanExecute` behavior they remain `partial`. Each extra records
its surface kind and hash; overloads with the same public name receive distinct
scenario IDs. An
Avalonia-only type records the count and hash of its complete public surface;
each mapped type records the same hash in `componentMap`.
The Contract V2 gate recomputes both inventories and fails when a type or member
is missing, duplicated, stale, or simultaneously mapped and extra. The semantic
baselines contain public symbols only, so internal implementation details do
not enter this registry.
