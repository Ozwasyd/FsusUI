# Interaction conformance scenarios

Interaction conformance scenarios are the shared source for Web Playwright
coverage and Avalonia headless xUnit coverage.

## Schema

Each scenario file uses the versioned YAML subset below:

```yaml
version: 1
platform: web | avalonia # optional, defaults to shared
scenarios:
  - id: stable-scenario-id
    component: button
    contract: spec/components/avalonia-first-subset.yaml#button # optional
    motionMode: reduced # optional
    steps:
      - render: { variant: primary, text: Save }
      - pointerover
      - focus
      - keyboard: Enter
      - assert: { emitted: press, finalState: default }
```

Allowed step types are `render`, `pointer`, `pointerover`, `focus`, `keyboard`,
and `assert`. Each scenario must render once and assert at least one expected
event or state. Normalized traces include a deterministic `shardKey`, so CI can
split generated scenarios without changing their order.

## Generated outputs

Run `pnpm run interactions:generate` after editing scenario files. The generator
writes:

- `tests/conformance/interactions/generated/normalized-traces.json`
- `tests/conformance/interactions/generated/web.generated.spec.ts`
- `dotnet/FsusUI.Avalonia.HeadlessTests/Generated/InteractionConformanceTests.cs`
- `tests/conformance/interactions/generated/run-interaction-conformance.mjs`

`pnpm run conformance:interactions` checks deterministic output, validates
negative fixtures, and executes the generated runner. Stable component issues
must add or update scenario coverage when they add interaction behavior.
