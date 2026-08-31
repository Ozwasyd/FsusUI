# FsusUI.Avalonia.Themes

`FsusUI.Avalonia.Themes` provides the first Avalonia theme baseline for FsusUI.
It consumes generated resources from `Generated/FsusTokens.axaml` and layers
hand-authored light/dark, density, focus, disabled, loading, overlay, and motion
resources on top.

For adoption setup, package references, and clean sample verification, see
[`docs/avalonia/installation.md`](../../docs/avalonia/installation.md).

## Import

```xml
<Application.Styles>
  <FluentTheme />
  <StyleInclude Source="avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml" />
</Application.Styles>
```

## Theme Manager

Use `FsusThemeManager` for runtime changes instead of mutating demo or
application resources directly:

```csharp
var manager = new FsusThemeManager();
manager.Apply(
  Application.Current!,
  new FsusThemeOptions
  {
    Variant = FsusThemeVariant.Dark,
    Density = FsusDensity.Compact,
    MotionMode = FsusMotionMode.Reduced,
    HighContrast = false,
    Palette = new FsusThemePaletteOptions
    {
      Background = new SolidColorBrush(Color.Parse("#F7F4EE")),
      Surface = new SolidColorBrush(Color.Parse("#FFFFFF")),
      Text = new SolidColorBrush(Color.Parse("#24211C")),
      Icon = new SolidColorBrush(Color.Parse("#4A453D")),
    },
    FollowSystemTheme = false,
  });
```

The manager applies resources in this order:

1. built-in light, dark, or high-contrast palette
2. nullable `FsusThemePaletteOptions` brush fields when high contrast is off
3. accent override
4. density resources
5. motion resources

`FsusThemePaletteOptions` accepts any `IBrush` for `Background`, `Surface`,
`SurfaceRaised`, `Text`, `MutedText`, `Border`, and `Icon` independently. A
null field keeps the selected built-in value. `Surface` also feeds the existing
shell, editor, tree, and picker surface aliases; `SurfaceRaised` feeds raised
picker and read-only states. High contrast retains its complete built-in palette.
Calling `Apply` again replaces the runtime resources, so controls consuming the
corresponding `DynamicResource` update without replacing theme dictionaries.

Unknown enum values fall back to light, default density, and system motion.
`FollowSystemTheme` sets `Application.RequestedThemeVariant` to
`ThemeVariant.Default` while keeping FsusUI resource fallbacks active.

## Scope

The package includes baseline styles for:

- `Button`, `FsusButton`, `FsusIconButton`, and `FsusButtonGroup`
- `FsusIcon`, `FsusText`, and `FsusLink`
- `TextBox`, `FsusInput`, `FsusTextarea`, and `FsusInputNumber`
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

Motion resources are exposed through stable theme keys:

- `FsusMotionModeCurrent`
- `FsusMotionDurationEffective`
- `FsusMotionEasingEffective`

Controls should consume these semantic resources instead of hard-coding local
durations or easing values.

`FsusMotionService` resolves stable Avalonia motion plans from the same token
set. It provides presets for control feedback, panel enter/leave, overlay
transitions, list item appearance, and action-row safe motion. `Reduced` mode
keeps terminal visual state with no travel or scale; `Disabled` mode resolves
immediately with `0ms` duration.

See `docs/avalonia/motion-runtime.md` for the runtime API and governance gate.

## Runtime Resource Dictionaries

Stable theme dictionaries are shipped for:

- `FsusLight.axaml`
- `FsusDark.axaml`
- `FsusHighContrast.axaml`
- `FsusDensityCompact.axaml`
- `FsusDensityDefault.axaml`
- `FsusDensitySpacious.axaml`
- `FsusMotionSystem.axaml`
- `FsusMotionEnabled.axaml`
- `FsusMotionReduced.axaml`
- `FsusMotionDisabled.axaml`
