# npm Public Preview Provenance Plan

Date: 2026-06-11
Repository: `Ozwasyd/FsusUI`

## Current Status

FsusUI publishes public-preview packages through npm public registry with tag-triggered GitHub Actions publishing.

## Required Provenance Approach

- Use npm trusted publishing through GitHub Actions OIDC when publishing public-preview packages.
- Use Node `22.14.0+` and npm CLI `11.5.1+`.
- Do not set `NODE_AUTH_TOKEN`; trusted publishing exchanges GitHub Actions OIDC for npm publish authorization.
- Trusted publishing generates provenance automatically.
- Require maintainer 2FA for npm account access.
- Never print npm token values, `.npmrc` contents, or auth headers in CI logs.

## Dist-Tag Evidence

```text
vX.Y.Z -> latest
vX.Y.Z-preview.N -> preview
vX.Y.Z-alpha.N / beta.N / rc.N / next.N -> next
```

Other prerelease identifiers fail before publish.

## Open Before Publish

- Confirm the npmjs.com trusted publisher entry uses owner `Ozwasyd`, repo `FsusUI`, workflow filename `publish-npm.yml`, and allowed action `npm publish`.
- Attach package audit and consumer install evidence to the public-preview release notes.
