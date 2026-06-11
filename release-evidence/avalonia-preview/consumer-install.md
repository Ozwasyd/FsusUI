# Avalonia Preview Consumer Install Evidence

## Command

```bash
dotnet new console --framework net10.0
dotnet add package FsusUI.Avalonia --source <local-or-preview-feed>
dotnet add package FsusUI.Avalonia.Themes --source <local-or-preview-feed>
dotnet add package FsusUI.Avalonia.Icons --source <local-or-preview-feed>
dotnet build
```

## Required Result

A fresh consumer project restores the preview packages, builds, and imports
theme/icon resources without requiring Web/npm internals.
