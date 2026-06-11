# FsusUI.Avalonia.Icons

`FsusUI.Avalonia.Icons` provides Avalonia icon resources generated from
`spec/icons/registry.yaml`.

## Import

```xml
<Application.Resources>
  <ResourceInclude Source="avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml" />
</Application.Resources>
```

Use `FsusIconKeys` for stable lookup instead of hard-coded resource keys.

## Semantics

Icon size, stroke, and fill names come from shared token ids:

- `icon.size.md`
- `icon.stroke.md`
- `icon.fill.default`

The generated XAML stores vector resources only. Controls remain responsible
for applying tokenized size, stroke, fill, foreground color, and accessibility
names.

## Accessibility

Decorative icons must not add redundant automation names. Semantic icons must
be paired with a visible label or `AutomationProperties.Name`. Icon-only
buttons must provide a stable accessible name, and loading states must not
replace that name with spinner-only content.
