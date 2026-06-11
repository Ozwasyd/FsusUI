# Avalonia Preview Build Evidence

## Command

```bash
pnpm run dotnet:build
```

## Required Result

- `dotnet/FsusUI.Avalonia.slnx` restores before build.
- `FsusUI.Avalonia`, `FsusUI.Avalonia.Themes`, and
  `FsusUI.Avalonia.Icons` build successfully.
- Demo and smoke projects build without becoming publishable packages.
