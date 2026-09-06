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
density sizing for `fsus-size-sm`, `fsus-size-md`, and `fsus-size-lg`. The
checked track resolves the scholarly primary action color with a knob at the
leading edge of the track, matching the Web `el-switch` core; Web renders the
active/inactive label pair around the core, and Avalonia composes those labels
from the host (see `FsusSwitch` `AccessibleName` for the accessible name).
Cross-platform element-crop evidence is registered in
`tests/conformance/visual/fixtures/visual-comparisons.json`
(`switch-vue-parity-web-avalonia`).

## Vue Contract Mapping

Vue checked values, checkbox buttons, check tags, radio groups, disabled
items, loading state, and keyboard contracts map to `IsChecked`, `Label`,
`SelectedValues`, `SelectedValue`, `ItemValue`, and typed value-changed events.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for native automation peers and high-contrast focus behavior.

## Theme Tokens

Use focus, disabled, accent, density, and text resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

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
