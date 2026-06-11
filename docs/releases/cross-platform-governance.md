# Cross-Platform Release Governance

FsusUI cross-platform releases are governed by a shared spec version, Web npm
package versions, Avalonia NuGet package versions, token schema version, and
component contract version.

## Version Sources

- spec version: recorded in `spec/` documents and contract files.
- token schema version: `spec/tokens/tokens.json`.
- Web package version: npm release workflow for `@ozwasyd/element-plus`.
- Avalonia package version: NuGet package metadata under `dotnet/`.
- component contract version: component contract files under `spec/components/`.

## Release Classification

Every cross-platform public contract change must be classified before release:

- `preview-patch`: documentation, tests, or non-breaking generated metadata.
- `preview-minor`: new token, component, pattern, mode, or public preview API.
- `preview-breaking`: rename, removal, incompatible behavior, or token type
  change during preview.
- `stable-breaking`: reserved for post-stable major version changes.

Contract files must include a release classification so CI can reject
unclassified public-contract changes.

## Consistency Target

FsusUI targets contract-perfect consistency and visually bounded variance.
It does not claim pixel-perfect equality across browser engines, Skia, DPI
modes, OS accessibility settings, or Linux compositor behavior.

## Evidence Requirements

Preview releases require:

- token generation/check evidence
- Web build/test evidence
- Avalonia restore/build/test evidence when Avalonia packages are in scope
- conformance gate output
- platform override review when a variance is accepted
- release notes that identify contract and token version changes
