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

Responsive measurement, keyboard focus, and native theme behavior follow
`docs/avalonia/platform-differences.md`.

## Theme Tokens

Public shell uses surface, raised surface, border, text, muted text, focus,
density, and motion resources.

## Minimal Avalonia Example

```csharp
using FsusUI.Avalonia.Controls;

var shell = new FsusPublicShell { Brand = "Fsus", ActiveNav = "home" };
shell.NavigationItems.Add(new FsusPublicShellNavigationItem("home", "Home", "/"));
```

## Known Limitations

Application routing and authentication state are owned by the product app.
