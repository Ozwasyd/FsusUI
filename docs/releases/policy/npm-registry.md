# npm Registry Publishing Policy

> **Role:** Normative npm distribution policy
> **Applies to:** Package naming, registry selection, dist-tags, trusted publishing, and npm evidence

This policy defines public-preview npm publishing and complements
[`docs/releases/governance.md`](../governance.md).

## Package and registry policy

The only current publishable package is:

```text
@ozwasyd/element-plus
```

It is the compatibility package for the Element Plus-derived workspace. The
long-term target is:

```text
@ozwasyd/fsus-ui
```

Until that name is approved, `@ozwasyd/element-plus` is the only package that
may be published. It may remain as a compatibility package only with a
documented compatibility contract and migration path. Internal packages under
`vue/internal/*` are never public, and packages containing `workspace:`
dependencies are not publishable. README install instructions must name the
active package and registry.

The npm public registry is canonical:

```text
https://registry.npmjs.org/
```

The retired package-registry automation is historical material under
[`docs/archive/github-packages/`](../../archive/github-packages/); it is not a
mirror or an active publishing path.

## Trusted publishing and provenance

- Publish public packages through npm trusted publishing with GitHub Actions
  OIDC and npm provenance.
- Maintainers require npm account 2FA. Do not use a long-lived automation token,
  set `NODE_AUTH_TOKEN`, or print tokens, `.npmrc`, or auth headers in logs.
- The npmjs.com trusted publisher must match owner `Ozwasyd`, repository `FsusUI`,
  workflow `publish-npm.yml`, and the `npm publish` action.

Candidate provenance is recorded in
`docs/releases/evidence/npm-public-preview/provenance.md`.

## Dist-tags and channel serialization

```text
latest  -> X.Y.Z
preview -> X.Y.Z-preview.N
next    -> X.Y.Z-alpha.N, X.Y.Z-beta.N, X.Y.Z-rc.N, X.Y.Z-next.N
```

Other prerelease channels fail before publish. `scripts/resolve-npm-dist-tag.mjs`
is the implementation; validate it with:

```bash
pnpm release:channel:resolve <version>
pnpm release:channel:check --candidate <version> --current <version> --candidate-exists false
pnpm release:concurrency:plan --package <name> --version <version>
pnpm test:release-channel
pnpm check:npm-release-workflow
```

Automatic publishing locks `registry + package name + resolved dist-tag`, with
`cancel-in-progress: false`. `publish-npm.yml` validates package, version,
registry, and tag against the immutable manifest; it queries channel state
before and after the lock and fails closed on query errors. A newer, absent
version may publish; an exact version/tag match is an idempotent skip; an older
candidate or an existing version assigned to another tag fails.

Stable `latest` additionally requires the successful FsusBlog consumer-gate
receipt for the same candidate. After an actual publish, the workflow polls the
canonical registry, downloads its tarball, verifies integrity, SHA-256,
name/version, and the `latest` tag, then sends the strict
`fsusui-npm-published-v1` dispatch. Preview/next releases, idempotent skips,
verification failures, and App permission failures send no event.

An intentional tag move uses only `recover-npm-dist-tag.yml`. It requires the
target version, expected current value, and reason; runs in the protected
`npm-recovery` environment; takes the same channel lock; and keeps
`NPM_RECOVERY_TOKEN` out of normal publishing.

## Candidate audit and consumer verification

Build and verify one candidate before publishing:

```bash
pnpm package:candidate:build
pnpm package:candidate:verify dist/npm-candidate/fsusui-npm-candidate.tgz
```

The tarball must not contain `.env`, `.npmrc`, private tokens, `workspace:`
protocols, local paths, private registry URLs, source maps, WASM debug output,
unnecessary tests/fixtures, private screenshots/docs, or large unused files.
The current audit is under `docs/releases/evidence/npm-public-preview/`.

Verify a fresh consumer install from that tarball:

```bash
pnpm test:consumer-matrix -- --candidate dist/npm-candidate/fsusui-npm-candidate.tgz
```

The three fixed profiles (`npm-latest`, `pnpm-latest`, `npm-peer-floor`) must
cover tarball installation, `vue-tsc`, Vite build, theme CSS, icon imports,
chunk budget, and forbidden-warning checks. Receipts must reference one
candidate digest; missing, skipped, failed, tampered, or mixed-candidate
receipts fail closed.

## Immutable candidate contract

```bash
pnpm package:candidate:build
pnpm package:candidate:verify dist/npm-candidate/fsusui-npm-candidate.tgz
pnpm test:consumer-matrix -- --candidate dist/npm-candidate/fsusui-npm-candidate.tgz
```

The adjacent manifest binds source commit, package identity, dist-tag, tarball
and canonical `package.json` digests, Node/pnpm/npm versions, lockfile digest,
build-input fingerprint, and publish/provenance metadata. Package smoke, cold
consumer installs, release aggregation, and publish all use that tarball; the
publish workflow never rebuilds it.

An optional rebuild is diagnostic only:

```bash
pnpm package:candidate:compare <tested-a.tgz> <rebuilt-b.tgz>
```

Comparison must prove identical canonical file lists and content digests. Even
after a successful comparison, tested candidate A remains the publish input.

## Release evidence

Public-preview records live under `docs/releases/evidence/npm-public-preview/`:
`package-audit.md`, `consumer-install.md`, and `provenance.md`. They document
candidate readiness; they do not redefine this policy.
