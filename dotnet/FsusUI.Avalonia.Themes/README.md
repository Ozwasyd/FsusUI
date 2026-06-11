# FsusUI.Avalonia.Themes

`FsusUI.Avalonia.Themes` provides the first Avalonia theme baseline for FsusUI.
It consumes generated resources from `Generated/FsusTokens.axaml` and layers
hand-authored light/dark, density, focus, disabled, loading, overlay, and motion
resources on top.

## Import

```xml
<Application.Styles>
  <FluentTheme />
  <StyleInclude Source="avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml" />
</Application.Styles>
```

## Scope

The package includes baseline styles for:

- `Button`
- `TextBox`
- `CheckBox`
- `RadioButton`
- `ToggleSwitch`
- `Border.fsus-card` and `ContentControl.fsus-card`
- `Window` overlay/dialog surfaces
- `TabControl` / `TabItem`
- `Menu` / `MenuItem`

The package is a theme foundation, not the complete Avalonia component library.
It does not expose Web DOM structure, Vue APIs, Element Plus class names, or
FsusPanel business logic.

## Motion Modes

Motion resources are exposed through theme keys:

- `FsusMotionModeSystem`
- `FsusMotionModeEnabled`
- `FsusMotionModeReduced`
- `FsusMotionModeDisabled`
- `FsusMotionDisabledDuration`
- `FsusMotionReducedDuration`

Controls should consume these semantic resources instead of hard-coding local
durations or easing values.

