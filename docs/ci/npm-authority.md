# npm dependency authority (#405 / #406)

> **Authority:** `config/dependencies/npm-authority.json`  
> **Schema:** `config/dependencies/npm-authority.schema.json`  
> **Inventory:** `config/dependencies/npm-authority.inventory.json`  
> **Migration freeze:** `config/dependencies/migration-baseline.json`  
> **Sync:** `pnpm deps:sync`  
> **Checks:** `pnpm deps:authority:check`, `pnpm deps:check`, `pnpm test:deps-sync`, `pnpm test:deps-check`

## Semantics

| Field | Meaning |
|-------|---------|
| `install` | Exact versions the monorepo installs for build/test/tools |
| `published.dependencies` / `optionalDependencies` | Semver ranges in the published package; each must contain the install pin |
| `published.peerDependencies` | Public peer contract ranges |
| `consumerProfiles` | Exact version sets for consumer matrix profiles; may only reference registered packages |

Internal packages use `workspace:` and are **not** listed as external authority entries.

## `pnpm deps:sync` (#406)

Projects authority into controlled manifests:

| Role | Paths | External field rule |
|------|-------|---------------------|
| root | `package.json` | install exact (`npm:` alias → exact target pin) |
| workspace | `vue/packages/*`, `vue/internal/*` | install exact; peers in `published.peerDependencies` use that range |
| published-source | `vue/packages/element-plus/package.json` | runtime deps/optional/peers from `published.*`; devDependencies install exact; `workspace:` kept |
| consumer-fixture | `vue/tests/consumer-install/template/package.json` | `consumerProfiles.npm-latest` when listed, else install exact |

Rules:

- No registry access; versions come only from the authority file.
- Deterministic dependency key order; second `pnpm deps:sync` is a zero-diff no-op.
- `prepare-npm-package.mjs` applies the same published external projection and does not invent versions.

```bash
pnpm deps:sync
git diff --exit-code
pnpm test:deps-sync
pnpm deps:authority:check
```

## `pnpm deps:check` (#408)

Read-only drift checker against `npm-authority.json`. Does **not** write files, does **not** run `deps:sync`, and does **not** contact the registry.

Validates:

- authority schema + required fields
- published ranges contain install pins; peer ranges yield a unique peer floor
- consumer profiles (including `npm-peer-floor` = `semver.minVersion` of peer ranges)
- every controlled manifest matches authority projection (root / workspace / published-source / consumer fixtures)
- install uniqueness (one exact version per external package ID)
- forbidden forms (`*`, `latest`, git/file/link, unregistered IDs, unresolvable ranges)
- package candidate / published-source external fields match authority
- lockfile importer resolved versions match `install` pins (lockfile is not authority)

Drift errors always print **file**, **field**, **expected**, **actual**.

```bash
pnpm deps:check
pnpm test:deps-check
```

## What #405 / #406 / #408 cover

- **#405:** authority schema, inventory, migration baseline digests.
- **#406:** `deps:sync` projection + mutation tests (script-local versions, registry latest, nondeterministic order, missed fixture).
- **#408:** read-only `deps:check` + semver containment / drift negative tests.
- **Not yet:** PR/release required gates / Renovate (#315 remaining).

## Mutation contract

- `pnpm deps:authority:check` fails on `*`, `latest`, git URLs, missing install pins for published IDs, and consumer profiles that invent unregistered package IDs.
- `pnpm test:deps-sync` fails if sync scripts embed package version tables, select registry latest, produce nondeterministic key order, or skip required consumer fixtures.
- `pnpm test:deps-check` fails if the checker auto-fixes, accepts wide-range install bypass, or skips required fixture scanning; negative fixtures cover root/workspace/fixture drift, published range exclusion, peer-floor failures, unregistered IDs, multi-version installs, candidate mismatch, and missing authority fields.
