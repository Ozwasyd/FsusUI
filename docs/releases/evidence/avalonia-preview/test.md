# Avalonia Preview Test Evidence

## Command

```bash
pnpm run dotnet:test
```

## Required Result

- Unit tests pass for the basic Avalonia control subset.
- Headless tests create the demo app builder without starting a desktop
  lifetime.
- CI records Linux and Windows results before preview release approval.
