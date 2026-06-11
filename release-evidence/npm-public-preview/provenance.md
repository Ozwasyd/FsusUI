# npm Public Preview Provenance Plan

Date: 2026-06-11
Repository: `Ozwasyd/FsusUI`

## Current Status

FsusUI is not approved for public npm publishing yet. The current package flow targets GitHub Packages, and public npm publication is gated by #8.

## Required Provenance Approach

- Use npm trusted publishing through GitHub Actions OIDC when publishing public-preview packages.
- Publish with provenance enabled, for example `npm publish --tag preview --provenance`.
- Require maintainer 2FA for npm account access.
- Avoid long-lived npm tokens. If a token is temporarily required, scope it to the package and keep it in GitHub Actions secrets.
- Never print npm token values, `.npmrc` contents, or auth headers in CI logs.

## Dist-Tag Evidence

Public preview must publish to `preview` or `next`, never directly to `latest`.

```text
latest  -> stable only
next    -> preview / prerelease
preview -> public-preview builds
canary  -> commit-based test builds if enabled
```

## Open Before Publish

- Create or update a GitHub Actions npm publish workflow using trusted publishing.
- Confirm package name policy between `@ozwasyd/fsus-ui` and `@ozwasyd/element-plus`.
- Attach package audit and consumer install evidence to the public-preview release notes.
