# Avalonia Preview Package Audit

## Commands

```bash
pnpm run dotnet:pack
pnpm run dotnet:metadata
pnpm run dotnet:package-smoke
```

## Required Result

- Packable projects produce non-empty `.nupkg` files.
- Demo, tests, and smoke projects remain unpublished.
- Package metadata includes id, description, repository URL, license, tags,
  version, readme where available, and release notes source.
