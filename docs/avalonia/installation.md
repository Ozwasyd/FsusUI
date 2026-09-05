# Install FsusUI Avalonia

Install the stable Avalonia packages into the consuming app:

```bash
dotnet add package FsusUI.Avalonia
dotnet add package FsusUI.Avalonia.Themes
dotnet add package FsusUI.Avalonia.Icons
```

Local workspace consumers can reference the three projects directly:

```xml
<ProjectReference Include="..\FsusUI.Avalonia\FsusUI.Avalonia.csproj" />
<ProjectReference Include="..\FsusUI.Avalonia.Themes\FsusUI.Avalonia.Themes.csproj" />
<ProjectReference Include="..\FsusUI.Avalonia.Icons\FsusUI.Avalonia.Icons.csproj" />
```

`FsusUI.Avalonia` contains the controls and shared contracts.
`FsusUI.Avalonia.Themes` contains resource dictionaries and
`FsusThemeManager`. `FsusUI.Avalonia.Icons` contains generated icon resources
and `FsusIconKeys`.

The shared overlay, motion, and platform contracts are documented in
[overlay host](overlay-host.md), [motion runtime](motion-runtime.md), and
[platform differences](platform-differences.md).

## Trimming and AOT Library Boundary

The three packages above declare an AOT-compatible library contract and run
trimming, single-file, and AOT analyzers. They do not set `PublishAot` or claim
that a final RID-specific Native AOT application has been validated. AXAML,
theme, token, and icon resources use the same package paths shown below for
trimmed and non-trimmed consumers. Application-owned reflection, runtime type
or assembly loading, runtime code generation, and third-party plugins remain
outside this library support statement; consumers must verify those boundaries.

## Application Setup

Import the theme and icon resources from the app:

```xml
<Application.Styles>
  <FluentTheme />
  <StyleInclude Source="avares://FsusUI.Avalonia.Themes/Themes/FsusTheme.axaml" />
</Application.Styles>

<Application.Resources>
  <ResourceInclude Source="avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml" />
</Application.Resources>
```

Apply runtime theme changes through the public manager:

```csharp
using FsusUI.Avalonia.Themes;

var manager = new FsusThemeManager();
manager.Apply(
  Application.Current!,
  FsusThemeOptions.Default with
  {
    Variant = FsusThemeVariant.Light,
    Density = FsusDensity.Default,
    MotionMode = FsusMotionMode.System,
    Palette = new FsusThemePaletteOptions
    {
      Background = new SolidColorBrush(Color.Parse("#F7F4EE")),
      Surface = new SolidColorBrush(Color.Parse("#FFFFFF")),
      Text = new SolidColorBrush(Color.Parse("#24211C")),
      Icon = new SolidColorBrush(Color.Parse("#4A453D")),
    },
  });
```

`FsusThemeManager.Apply` keeps variant-aware semantic brushes current. Dynamic
resources update immediately when the variant switches; an explicit
`AccentOverride` wins while provided. The optional `Palette` accepts nullable `IBrush`
overrides for background, surface, raised surface, text, muted text, border,
and icon. Null fields retain the selected built-in palette; high contrast keeps
its complete built-in palette, so consumers do not need to fork the shipped
dictionaries. `FsusColorActionPrimaryBrush` resolves to `#2A599C` in light and
`#4B79CC` in dark. `Surface` feeds shell, editor, tree, and picker aliases, while
`SurfaceRaised` feeds raised picker and read-only states.

`Apply` resolves resources in this order: built-in light/dark/high-contrast
palette, nullable palette overrides when high contrast is off, accent override,
density, then motion. Unknown enum values fall back to light, default density,
and system motion; `FollowSystemTheme` sets `Application.RequestedThemeVariant`
to `ThemeVariant.Default` while FsusUI resource fallbacks remain active.

## Clean Consumer Sample

`FsusUI.Avalonia.ConsumerSample` is a clean sample project that references
`FsusUI.Avalonia`, `FsusUI.Avalonia.Themes`, and `FsusUI.Avalonia.Icons`.
It validates public controls, icon keys, theme options, and a smoke exit path:

```bash
dotnet restore dotnet/FsusUI.Avalonia.ConsumerSample/FsusUI.Avalonia.ConsumerSample.csproj
dotnet build dotnet/FsusUI.Avalonia.ConsumerSample/FsusUI.Avalonia.ConsumerSample.csproj
dotnet run --project dotnet/FsusUI.Avalonia.ConsumerSample/FsusUI.Avalonia.ConsumerSample.csproj -- --smoke
```

Use the sample as the smallest CI restore/build/run check for product apps.
