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
  });
```

`FsusThemeManager.Apply` keeps the variant-aware semantic brushes current on
every call. `{DynamicResource FsusColorActionPrimaryBrush}` resolves to
`#2A599C` under the light palette and `#4B79CC` under the dark palette; an
explicit `AccentOverride` replaces it while one is provided. Components bound
through `{DynamicResource ...}` update immediately when the variant switches.

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
