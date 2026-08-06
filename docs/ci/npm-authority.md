# npm dependency authority (#405 / #406)

> **Authority:** `config/dependencies/npm-authority.json`  
> **Schema:** `config/dependencies/npm-authority.schema.json`  
> **Inventory:** `config/dependencies/npm-authority.inventory.json`  
> **Migration freeze:** `config/dependencies/migration-baseline.json`  
> **Sync:** `pnpm deps:sync`  
> **Checks:** `pnpm deps:authority:check`, `pnpm test:deps-sync`

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

## What #405 / #406 cover

- **#405:** authority schema, inventory, migration baseline digests.
- **#406:** `deps:sync` projection + mutation tests (script-local versions, registry latest, nondeterministic order, missed fixture).
- **Not yet:** full read-only `deps:check` CI gates / Renovate (#315 remaining).

## Mutation contract

- `pnpm deps:authority:check` fails on `*`, `latest`, git URLs, missing install pins for published IDs, and consumer profiles that invent unregistered package IDs.
- `pnpm test:deps-sync` fails if sync scripts embed package version tables, select registry latest, produce nondeterministic key order, or skip required consumer fixtures.
