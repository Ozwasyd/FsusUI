# Avalonia Semantic Baseline

> **Role:** Machine-observed public API baseline for the Avalonia packages.
> **Applies to:** `FsusUI.Avalonia`, `FsusUI.Avalonia.Themes`,
> `FsusUI.Avalonia.Icons`.

The semantic baseline combines the compiled public surface with compiler
semantics from the corresponding C# source
(`dotnet/FsusUI.Avalonia.ApiTool`) and is committed to
`spec/avalonia/semantic/`. Reflection records public type/member identity,
signatures, and accessibility. Roslyn records property `required` modifiers and
defaults only when a CLR initializer or Avalonia
`Register`/`RegisterAttached`/`RegisterDirect` argument has a compiler-known
constant. Complex or unresolved expressions remain explicitly unknown; the
extractor does not execute field initializers or source code.

Reflection also records exact enum member names/numeric values and
`ObsoleteAttribute` state/message for public types and members. Contract V2
compares a property whose compiled type is an enum only with a compiler-known
Vue literal-value set. The normalized sets must be equal; an unresolved union,
expression-backed value, or missing enum type remains `partial`.

Each baseline also records hashes for its input tree, compiler options, and
dependency assembly identities. The freshness check regenerates the baseline
and runs real-source mutations for literal defaults, CLR initializers, required
modifiers, and non-constant expressions.

## Regeneration

```sh
pnpm run avalonia:semantic        # rebuild spec/avalonia/semantic/*.json
pnpm run avalonia:semantic:check  # fail when the committed baseline drifts
```

Compiler-generated types (for example `CompiledAvaloniaXaml.!AvaloniaResources`)
are excluded; only types whose full name starts with `FsusUI.Avalonia` are
captured.

## Relationship to Contract V2

`scripts/contract-v2.mjs` consumes this baseline together with
`spec/baselines/vue-current.json` and produces
`spec/components/contracts/v2/contract-v2.json`. The committed baseline hash is
recorded in the registry, so any semantic change without regeneration fails
`pnpm run contract-v2:check`.
