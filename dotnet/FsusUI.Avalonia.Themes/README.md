# FsusUI.Avalonia.Themes

`FsusUI.Avalonia.Themes` provides the first Avalonia theme baseline for FsusUI.
It consumes generated resources from `Generated/FsusTokens.axaml` and layers
hand-authored light/dark, density, focus, disabled, loading, overlay, and motion
resources on top.

For adoption setup, package references, and clean sample verification, see
[`docs/avalonia/installation.md`](../../docs/avalonia/installation.md).

## Trimming and AOT

Generated tokens and shipped AXAML dictionaries stay on the normal package
resource path; there is no AOT-only theme path. For the shared analyzer
boundary and consumer-owned Native AOT verification, see [Avalonia installation](../../docs/avalonia/installation.md#trimming-and-aot-library-boundary).

## Import

```xml
<Application.Styles>
  <FluentTheme />
  <StyleInclude Source="avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml" />
</Application.Styles>
```

## Theme Manager

Use `FsusThemeManager` for runtime changes as shown in [Application Setup](../../docs/avalonia/installation.md#application-setup).
That canonical contract defines palette precedence, nullable brush overrides,
dynamic-resource updates, high-contrast behavior, and enum fallbacks.

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

Motion keys, service presets, reduced/disabled behavior, and the governance gate
are defined in [`docs/avalonia/motion-runtime.md`](../../docs/avalonia/motion-runtime.md).
Controls consume those semantic resources instead of hard-coding local plans.
The stable resource keys include `FsusMotionModeCurrent`,
`FsusMotionDurationEffective`, and `FsusMotionEasingEffective`.

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
