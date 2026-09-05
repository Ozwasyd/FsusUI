# Cross-Platform Release Policy

> **Role:** Normative cross-platform release policy
> **Applies to:** Shared spec versions, Web/Avalonia classification, evidence, and bounded platform variance

Web/Vue and Avalonia/.NET share platform-neutral contracts but publish through
separate npm and NuGet channels. A channel-specific patch must not redefine the
shared spec or token semantics.

## Version sources

| Contract | Source of truth |
| --- | --- |
| Spec | `spec/` documents and contract files |
| Token schema version | `spec/tokens/tokens.json` |
| Web package | npm workflow for `@ozwasyd/element-plus` |
| Avalonia packages | NuGet metadata under `dotnet/` |
| Component contract | `spec/components/` |
| Contract V2 | `spec/components/contracts/v2/contract-v2.json` |

Regenerate and check Contract V2 with `pnpm run contract-v2:check` whenever the
Web or Avalonia semantic baseline changes. An Avalonia-only preview still
points to the same `spec/tokens`, `spec/components`, `spec/motion`, and
`spec/icons` sources. Release notes for a shared-contract change name every
affected spec, token-schema, npm, and NuGet version.

## Release classification

Classify every cross-platform public-contract change before release:

- `preview-patch`: docs, tests, or non-breaking generated metadata;
- `preview-minor`: a new token, component, pattern, mode, or preview API;
- `preview-breaking`: a rename, removal, incompatible behavior, or token-type
  change during preview; and
- `stable-breaking`: reserved for post-stable major changes.

Contract files must carry a classification so CI can reject an unclassified
public-contract change.

## Consistency and evidence

FsusUI targets contract-perfect consistency with visually bounded variance; it
does not promise pixel identity across browser engines, Skia, DPI modes, OS
accessibility settings, or Linux compositor behavior.

Preview releases require token generation/check, Web build/test, Avalonia
restore/build/test when in scope, conformance gates, platform-override review
for accepted variance, and release notes naming contract/token version changes.
