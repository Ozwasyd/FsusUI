# npm dependency authority (#405)

> **Authority:** `config/dependencies/npm-authority.json`  
> **Schema:** `config/dependencies/npm-authority.schema.json`  
> **Inventory:** `config/dependencies/npm-authority.inventory.json`  
> **Migration freeze:** `config/dependencies/migration-baseline.json`  
> **Check:** `pnpm deps:authority:check`

## Semantics

| Field | Meaning |
|-------|---------|
| `install` | Exact versions the monorepo installs for build/test/tools |
| `published.dependencies` / `optionalDependencies` | Semver ranges in the published package; each must contain the install pin |
| `published.peerDependencies` | Public peer contract ranges |
| `consumerProfiles` | Exact version sets for consumer matrix profiles; may only reference registered packages |

Internal packages use `workspace:` and are **not** listed as external authority entries.

## What #405 does / does not do

- **Does:** freeze the controlled package inventory, schema, inventory report, and lock/manifest digests before any `deps:sync`.
- **Does not:** implement `deps:sync` / `deps:check`, upgrade dependencies, or wire release workflows (see #406+).

## Mutation contract

`pnpm deps:authority:check` fails on `*`, `latest`, git URLs, missing install pins for published IDs, and consumer profiles that invent unregistered package IDs.
