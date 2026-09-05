# Cross-Platform FsusUI Roadmap Status

> **Role:** Current cross-platform roadmap record
> **Applies to:** Web/Vue and Avalonia/.NET contract boundaries
> **Authority:** Point-in-time status; `spec/` and release policies own the contracts.

FsusUI has a cross-platform foundation for Web/Vue and Avalonia/.NET without
sharing component implementation source.

## Layer Model

```txt
spec/
  -> generated artifacts
  -> Web/Vue implementation
  -> Avalonia implementation
  -> product integrations
```

Boundaries:

- `spec/` defines platform-neutral tokens, component contracts, UX patterns,
  accessibility mappings, icon semantics, motion semantics, and platform
  override policy.
- generated artifacts are emitted by `scripts/token-pipeline.mjs` from
  `spec/tokens/tokens.json`.
- Web/Vue keeps the existing FsusUI / Element Plus-compatible implementation and
  consumes generated Web token artifacts.
- Avalonia/.NET consumes generated XAML and C# token artifacts through
  `FsusUI.Avalonia` and `FsusUI.Avalonia.Themes`.
- product integrations consume public FsusUI packages and docs; they must not
  target private DOM selectors, generated WASM paths, or Avalonia template
  parts.

Complex Avalonia components such as DataTable, VirtualList, LogViewer,
TerminalPanel, MarkdownViewer, FileManager, Tree, TreeTable, and CodeBlock are
tracked in
[`docs/avalonia/complex-components-roadmap.md`](./avalonia/complex-components-roadmap.md).
They are not included in the first basic Avalonia support scope.

## Closed Child Issues

| Issue                       | Status | Repository Evidence                                                                                                     |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| #16 Motion system           | Closed | `vue/packages/motion`, component `motion` props, GSAP wrappers, `docs/components/motion.md`                                 |
| #19 Platform-neutral spec   | Closed | `spec/README.md`, `spec/architecture.md`, token/component/pattern/a11y/motion/icon docs                                 |
| #20 Token generator         | Closed | `spec/tokens/tokens.json`, `scripts/token-pipeline.mjs`, generated Web/Avalonia/docs/checksum artifacts, CI token gate  |
| #21 Avalonia theme baseline | Closed | `dotnet/FsusUI.Avalonia.Themes`, generated token resource import, light/dark dictionaries, control baselines, smoke app |
| #22 Avalonia demo shell     | Closed | `dotnet/FsusUI.Avalonia.Demo`, reference shell pages, light/dark/density/motion switching, startup smoke                |
| #29 Complex component plan  | Closed | `docs/avalonia/complex-components-roadmap.md`, `spec/components/complex-components-roadmap.yaml`                        |

## Dependency Rules

Allowed dependencies:

- Web implementation -> `spec/` and generated Web token artifacts
- Avalonia implementation -> `spec/`, generated Avalonia token artifacts, and
  `FsusUI.Avalonia.Themes`
- product apps -> published public FsusUI packages and documented contracts

Disallowed dependencies:

- Avalonia -> Vue files, Element Plus internals, DOM structure, CSS selectors
- Web -> Avalonia resource keys as source contracts, XAML templates, .NET
  implementation details
- product apps -> undocumented selectors, generated WASM paths, Avalonia template
  parts, or local duplicated motion systems

## Motion Alignment

The Web-side motion work from #16 is the input for cross-platform motion
semantics. `spec/motion/README.md` defines the neutral modes and preset
families, while `docs/engineering-handoff.md` records the implemented Web
motion APIs and FsusBlog consumption rules. Avalonia theme resources expose the
same `system`, `enabled`, `reduced`, and `disabled` modes at the resource layer
so controls can consume semantic motion policy without duplicating Web motion
implementation details.
