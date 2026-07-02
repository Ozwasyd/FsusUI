# Regeneration

## Regenerated from CI artifacts

To regenerate this bundle from CI artifacts:

1. Download `avalonia-stable-evidence`, `avalonia-generated-artifacts`,
   `dotnet-build-output-*`, `avalonia-screenshots-*`, `unit-test-artifacts`,
   and `fsusui-npm-package-dist` from the successful release Quality Gates run.
2. Restore generated artifacts into the repository root.
3. Run:

```bash
pnpm run verify:stable
pnpm run dotnet:verify
node scripts/check-avalonia-stable-readiness.mjs
```

The regenerated output must preserve the contract version, token version, icon
version, npm version, NuGet version, package audit, consumer install results,
visual diff summary, accessibility summary, performance summary, and active
platform overrides recorded in this directory.
