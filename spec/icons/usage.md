# Icon Registry Usage

The icon registry defines semantic icon ids, categories, vector paths, default
size tokens, stroke/fill tokens, and accessibility behavior. Size, stroke, and
fill values must point to shared token names from `spec/tokens/tokens.json`.

Decorative icons must not add redundant accessible names. Semantic icons must
provide an accessible label through the consuming component. Icon-only buttons
must always provide a user-facing accessible name in both Web and Avalonia.

For icon-only buttons:

- Web: provide visible text or `aria-label`/`aria-labelledby`; decorative glyphs
  must not create duplicate accessible names.
- Avalonia: provide visible text or `AutomationProperties.Name`; decorative
  glyphs must not replace the button's automation name.
- `FsusIconButton.AccessibleName` syncs to `AutomationProperties.Name`;
  `FsusIconButton.IsDecorativeIcon` marks intentionally decorative glyph-only
  controls.
- Loading icon-only buttons must retain that accessible name while exposing
  busy/loading through the host control.

Generated outputs and their regeneration checks are documented in
[`README.md#generated-artifacts`](./README.md#generated-artifacts):

- Web metadata: `vue/packages/icons-vue/generated/icon-metadata.json`
- Avalonia resources: `dotnet/FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml`
- C# keys: `dotnet/FsusUI.Avalonia.Icons/Generated/FsusIconKeys.g.cs`
- Stable inventory: `docs/icons/generated/stable-icons.md`
- Visual baseline: `tests/conformance/visual/icon-baselines.json`
