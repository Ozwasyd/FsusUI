# Changesets

FsusUI uses Changesets for versioning and changelog generation.

## Workflow

1. Add a changeset for any user-facing change:
   - `pnpm changeset`
2. Merge the change into `main`.
3. Generate version bumps and changelogs:
   - `pnpm version-packages`
4. Publish only after `pnpm verify:release` passes.

## Scope

- Use `patch` for fixes and backwards-compatible refinements.
- Use `minor` for additive features.
- Use `major` for breaking changes.
