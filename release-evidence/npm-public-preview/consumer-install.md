# npm Public Preview Consumer Install Evidence

Date: 2026-06-11
Repository: `Ozwasyd/FsusUI`
Candidate commit: this file's containing commit

## Command

```bash
pnpm test:consumer-install
```

## Required Coverage

- Fresh fixture project
- Install generated package tarball
- `vue-tsc --noEmit`
- `vite build`
- Theme CSS import
- Icon imports
- Chunk budget and forbidden warning checks

## Result

Passed for candidate package `@ozwasyd/element-plus@1.5.0`.

Observed output:

```text
dependencies:
+ @ozwasyd/element-plus file:/tmp/fsusui-consumer-sDChKO/artifacts/ozwasyd-element-plus-1.5.0.tgz

vite v7.3.1 building client environment for production...
✓ 1911 modules transformed.
✓ built in 12.97s
Consumer JS chunk budget passed: largest=vendor-shikijs-langs-DEXqtc4K.js 476.08 KiB.
Consumer install smoke passed for @ozwasyd/element-plus.
```

This verifies tarball install, `vue-tsc --noEmit`, Vite production build, theme CSS import, icon imports, forbidden warning checks, and the 500 KiB JS chunk budget.
