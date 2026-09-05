# FsusUI Avalonia Demo

This reference shell validates FsusUI.Avalonia consumption. It is not a
product app and does not implement FsusPanel, FsusBlog, DataTable,
TerminalPanel, LogViewer, FileManager, or MarkdownEditor features.

## Run

```bash
dotnet run --project dotnet/FsusUI.Avalonia.Demo/FsusUI.Avalonia.Demo.csproj
```

Headless startup smoke:

```bash
dotnet run --project dotnet/FsusUI.Avalonia.Demo/FsusUI.Avalonia.Demo.csproj -- --smoke
```

## Scope

The shell includes:

- app shell with sidebar, topbar, breadcrumb, and content surface
- dashboard card grid
- settings page
- list page with table toolbar placeholder
- detail page
- form page
- empty state
- error state
- dangerous action confirmation example
- dialog and overlay gallery
- light/dark switching
- default/compact/spacious density switching
- system/enabled/reduced/disabled motion mode switching
- long Chinese and English text cases

## Validation Notes

Minimum supported window size: `1024x680`.

Suggested screenshot viewport: `1180x760`.

Use this demo for early screenshots and visual regression baselines after adding the
Avalonia test harness. The current shell validates theme import, generated
token consumption, focusable controls, resizing pressure, text wrapping,
high-DPI-safe static data, and Linux desktop builds.
