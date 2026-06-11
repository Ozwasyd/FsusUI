# npm Registry Publishing Policy

This policy defines how FsusUI will approach public npm registry publishing for public preview. It complements the current GitHub Packages release flow in [release governance](../release-governance.md).

## Package Name Policy

Current publishable package:

```text
@ozwasyd/element-plus
```

This name is the compatibility package for the current Element Plus-derived workspace. It remains the only package that may be published until public-preview naming is approved.

Long-term public package target:

```text
@ozwasyd/fsus-ui
```

Policy:

- `@ozwasyd/fsus-ui` is the preferred long-term product package name.
- `@ozwasyd/element-plus` may remain as a compatibility package only when a compatibility contract and migration path are documented.
- Internal workspace packages under `internal/*` are never public packages.
- Packages that still contain `workspace:` dependency protocol are not publishable.
- README install instructions must name the active package and registry.

## Registry Policy

Current status:

```text
GitHub Packages only
```

Public-preview target:

```text
npm registry primary
GitHub Packages optional mirror
```

The npm registry should become the canonical registry for public OSS consumption after #8 public-preview readiness gates pass. GitHub Packages can remain a mirror or private transition channel, but docs must say which registry is canonical for each release line.

## Trusted Publishing and Provenance

Preferred public npm publishing approach:

- npm trusted publishing through GitHub Actions OIDC.
- npm provenance enabled for public packages.
- npm account 2FA required for maintainers.
- No long-lived npm automation token unless trusted publishing is unavailable.
- If token-based publishing is temporarily required, use a least-privilege automation token scoped to publish only the approved package.
- CI logs must never print npm tokens, `.npmrc` contents, or auth headers.

The provenance evidence for the current public-preview candidate is tracked in `release-evidence/npm-public-preview/provenance.md`.

## Dist-Tag Policy

```text
latest  -> stable releases only
next    -> preview or prerelease builds
preview -> public-preview builds
canary  -> commit-based test builds, if enabled
```

First public preview must not publish directly to `latest`. Use a preview or next tag such as:

```bash
npm publish --tag preview --provenance
```

Stable `latest` requires a documented API stability policy, consumer install evidence, package-content audit evidence, and security policy.

## Package Content Audit

Before any public publish, run and record:

```bash
pnpm run build:github-package
cd dist/element-plus
npm pack --dry-run --json
pnpm pack --dry-run
```

Audit the candidate package for:

```text
.env
.npmrc
private tokens
workspace: dependency protocol
local paths
private registry URLs
source maps policy
WASM debug artifacts
unnecessary tests / fixtures
private screenshots / docs
large unused files
```

Current evidence is recorded in `release-evidence/npm-public-preview/package-audit.md`.

## Consumer Install Verification

The public candidate must pass a fresh fixture install from the generated tarball:

```bash
pnpm test:consumer-install
```

The fixture must verify:

- package tarball install
- `vue-tsc`
- Vite build
- theme CSS import
- icon imports
- chunk budget and forbidden Vite warning checks

Current evidence is recorded in `release-evidence/npm-public-preview/consumer-install.md`.

## Release Evidence

Public-preview publishing requires evidence files under:

```text
release-evidence/npm-public-preview/
```

Required records:

- `package-audit.md`
- `consumer-install.md`
- `provenance.md`

These files record candidate readiness. They do not by themselves authorize publishing; public-preview publishing still depends on the readiness gate in #8.
