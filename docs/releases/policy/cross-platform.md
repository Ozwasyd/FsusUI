# Cross-Platform Release Governance

> **Role:** Normative cross-platform release policy
> **Applies to:** Shared spec versions, Web/Avalonia release classification, evidence, and bounded platform variance

FsusUI cross-platform releases are governed by a shared spec version, Web npm
package versions, Avalonia NuGet package versions, token schema version, and
component contract version.

## Version Sources

- spec version: recorded in `spec/` documents and contract files.
- token schema version: `spec/tokens/tokens.json`.
- Web package version: npm release workflow for `@ozwasyd/element-plus`.
- Avalonia package version: NuGet package metadata under `dotnet/`.
- component contract version: component contract files under `spec/components/`.
- Contract V2 version: `spec/components/contracts/v2/contract-v2.json` maps the
  real Web and Avalonia semantic baselines; it must be regenerated and checked
  (`pnpm run contract-v2:check`) whenever either baseline changes.

Web npm packages, Avalonia NuGet packages, and generated token/spec artifacts
share the same platform-neutral contract but remain separate distribution
channels. A Web-only npm patch must not silently redefine spec or token
semantics; an Avalonia-only NuGet preview must point back to the same
`spec/tokens`, `spec/components`, `spec/motion`, and `spec/icons` sources. When
the shared contract changes, release notes must name the affected spec version,
token schema version, npm package version, and NuGet package version.

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
