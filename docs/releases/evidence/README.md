# Release Evidence

> **Role:** Point-in-time release evidence navigation
> **Authority:** Non-normative records proving or documenting a candidate against policy and readiness contracts

Evidence records must identify the relevant candidate, date, version, commit, run, or regeneration source whenever available. They must not introduce new release requirements.

- [`npm-public-preview/`](./npm-public-preview/): npm package audit, install, and provenance evidence
- [`public-preview/`](./public-preview/): repository-level public-preview scans and package-content links
- [`avalonia-preview/`](./avalonia-preview/): Avalonia preview build, test, package, and platform evidence
- [`avalonia-stable/`](./avalonia-stable/README.md): Avalonia stable signoff evidence

Do not store active release evidence outside `docs/releases/evidence/`.
