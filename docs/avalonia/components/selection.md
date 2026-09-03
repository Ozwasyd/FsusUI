# Selection

Component ID: `selection`

## Avalonia API

Use `FsusCheckbox`, `FsusCheckboxGroup`, `FsusCheckboxButton`, `FsusRadio`,
`FsusRadioGroup`, `FsusCheckTag`, and `FsusSwitch` for boolean, three-state,
and grouped selection. `FsusCheckTag` renders the Web authority presentation:
`color.fill.lighter` surface with a 1px `color.border.subtle` outline at
11px/700, and a checked state filled with Scholarly Blue
(`color.action.primary`) and paper-white text. `FsusCheckboxButton` renders
the Web authority presentation: a transparent surface with `color.text.quiet`
label at weight 500, and a checked state on the paper surface with
`color.text.primary` label and the `shadow.panel.lighter` elevation; the
disabled state uses the paper surface with a `color.border.light` outline.
button-styled, toggleable, grouped, and exclusive selection.

`FsusSwitch` ships a native control template in
`Themes/Controls/Switch.axaml` that resolves every template part
`ToggleSwitch.OnApplyTemplate` requires (`PART_MovingKnobs`, plus the
positioning part `PART_SwitchKnob`). Without such a template, opening any
native window that lays out a switch throws
`KeyNotFoundException: Could not find control 'PART_MovingKnobs'`. The
template covers plain `ToggleSwitch` controls as well as `FsusSwitch`, with
density sizing for `fsus-size-sm`, `fsus-size-md`, and `fsus-size-lg`.

## Vue Contract Mapping

Vue checked values, checkbox buttons, check tags, radio groups, disabled
items, loading state, and keyboard contracts map to `IsChecked`, `Label`,
`SelectedValues`, `SelectedValue`, `ItemValue`, and typed value-changed events.

## Supported Platform Differences

Native automation peers and high-contrast focus behavior follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Selection controls use focus, disabled, accent, density, text, and motion
resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var optIn = new FsusCheckbox
{
  Content = "Send release alerts",
  ItemValue = "alerts",
  IsChecked = true,
};
```

## Known Limitations

Group item ordering is based on Avalonia child order, not DOM order queries.
