# FsusUI Specification

`spec/` is the platform-neutral source of truth for FsusUI behavior. It defines
public design contracts that Web/Vue, Avalonia, and product integrations consume
without depending on each other's implementation details.

The specification owns:

- token categories and naming rules
- component contracts, states, events, content regions, and accessibility
- product-level UX patterns
- platform-neutral motion semantics
- icon semantics and sizing rules
- explicit platform override policy

The specification does not own:

- Element Plus class names, DOM selectors, Vue lifecycle details, or Composition
  API implementation choices
- Avalonia `ControlTheme`, XAML template parts, `StyledProperty`, or MVVM
  implementation choices
- product-specific business logic from FsusBlog, FsusPanel, or downstream apps

Product apps must consume public FsusUI tokens, contracts, components, and
patterns. They must not couple to undocumented Web internals, generated WASM
paths, private CSS selectors, or Avalonia template parts.

## Public Contract Model

Each spec domain follows the same model:

1. Define a stable platform-neutral concept.
2. Map the concept to Web and Avalonia in implementation packages or generated
   adapters.
3. Register allowed platform differences under `platform-overrides/`.
4. Test conformance at the token, contract, interaction, accessibility, and
   visual-boundary layers.

See [`architecture.md`](./architecture.md) for the full separation model.
