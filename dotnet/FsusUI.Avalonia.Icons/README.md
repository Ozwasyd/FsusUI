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
`docs/icons/generated/stable-icons.md` lists the matching Vue component and
Avalonia resource key for every stable icon.
`FsusUI.Avalonia.Controls.FsusIcon` can consume these resources through
`IconKey` plus `Data="{StaticResource ...}"` without changing the generated
source set.

## Semantics

Icon size, stroke, and fill names come from shared token ids:

- `icon.size.md`
- `icon.stroke.md`
- `icon.fill.default`

The generated XAML stores vector resources only. The icon pipeline validates
that each Avalonia `StreamGeometry` matches the same SVG path data used by the
Vue component. Controls remain responsible for applying tokenized size, stroke,
fill, foreground color, and accessibility names.

## Accessibility

Decorative icons must not add redundant automation names. Semantic icons must
be paired with a visible label or `AutomationProperties.Name`. Icon-only
buttons must provide a stable accessible name through
`FsusIconButton.AccessibleName` or explicitly set
`FsusIconButton.IsDecorativeIcon`. Loading states must not replace that name
with spinner-only content.
