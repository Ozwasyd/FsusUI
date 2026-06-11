# Public Preview Package Content Audit Link

Date: 2026-06-11
Repository: `Ozwasyd/FsusUI`
Candidate commit: this file's containing commit

The package content dry-run audit for the public-preview candidate is recorded
in:

- `release-evidence/npm-public-preview/package-audit.md`
- `release-evidence/npm-public-preview/consumer-install.md`
- `release-evidence/npm-public-preview/provenance.md`

The package audit records:

- `pnpm run build:npm-package`
- `npm pack --dry-run --json`
- `pnpm pack --dry-run`
- token and private registry scans over the prepared package
- workspace dependency checks
- source map policy checks
- WASM artifact checks
- absence of packed private screenshots, tests, `.env`, and `.npmrc` files

The consumer install evidence records a fresh fixture install from the generated
tarball, `vue-tsc --noEmit`, Vite production build, theme CSS import, icon
imports, forbidden warning checks, and JS chunk budget validation.
