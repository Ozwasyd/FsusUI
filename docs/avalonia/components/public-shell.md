# Public shell

Component ID: `public-shell`

## Avalonia API

Use `FsusPublicShell`, `FsusSiteHeader`, `FsusResponsiveCollection`,
`FsusThemeModeToggle`, and their public navigation and collection records.

## Vue Contract Mapping

Vue public shell, site header, responsive collection, and theme mode toggle
slots map to brand content, navigation item records, active state, and typed
theme mode events.

## Supported Platform Differences

See [`docs/avalonia/platform-differences.md`](../platform-differences.md) for responsive measurement, keyboard focus, and native-theme boundaries.

## Theme Tokens

Use surface, raised-surface, border, text, muted-text, focus, and density resources from [Application Setup](../installation.md#application-setup); motion behavior is defined in [Avalonia Motion Runtime](../motion-runtime.md).

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var shell = new FsusPublicShell { Brand = "Fsus", ActiveNav = "home" };
shell.NavigationItems.Add(new FsusPublicShellNavigationItem("home", "Home", "/"));
```

## Known Limitations

Application routing and authentication state are owned by the product app.
