# Avalonia Stable RC Evidence

> **Role:** Point-in-time Avalonia stable signoff evidence

This bundle is the release-candidate signoff record for marking
`FsusUI.Avalonia`, `FsusUI.Avalonia.Themes`, and `FsusUI.Avalonia.Icons`
stable. It is regenerated from CI artifacts by restoring the Quality Gates
outputs listed in [CI run ids](ci-run-ids.md) and rerunning the verification
commands in [regeneration](regeneration.md).

## Required Evidence

- [Contract version, token version, icon version, npm version, and NuGet version](versions.md)
- [CI run ids](ci-run-ids.md)
- [Platform matrix](platform-matrix.md)
- [Package audit](package-audit.md)
- [Consumer install results](consumer-install.md)
- [Visual diff summary](visual-diff-summary.md)
- [Accessibility summary](accessibility-summary.md)
- [Performance summary](performance-summary.md)
- [Active platform overrides](active-platform-overrides.md)
- [Stable-readiness checklist](stable-readiness-checklist.md)
- [Release notes](release-notes.md)
- [Preview-to-stable migration](preview-to-stable-migration.md)
- [Known limitations](known-limitations.md)
- [Regenerated from CI artifacts](regeneration.md)

## RC Decision

The stable scope is ready for an RC tag once the Quality Gates run for the final
commit completes and the attached artifacts reproduce the local evidence in
this directory. Known limitations are scoped deferrals, not missing baseline
components.
