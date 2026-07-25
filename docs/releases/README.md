# Release Documentation

> **Role:** Release-domain navigation and placement contract
> **Applies to:** FsusUI maintainers, release owners, automation, and downstream consumers reviewing published evidence
> **Authority:** This document controls release-document placement. Release behavior remains governed by the linked policy, readiness, workflow, and machine-readable sources.

All active release documentation lives under the canonical `docs/releases/` domain. Do not recreate the retired single-form `docs/release/` path or a repository-root `release-evidence/` directory.

## Directory semantics

| Path | Meaning | Lifecycle | Normative |
| --- | --- | --- | --- |
| [`governance.md`](./governance.md) | Repository-wide versioning, quality-gate, candidate, publish, and rollback process | Long-lived | Yes |
| [`policy/`](./policy/) | Distribution-channel and cross-platform release rules | Long-lived | Yes |
| [`channels/`](./channels/) | Current release-channel status, supported packages, and channel-facing notes | Updated with channel state | Informational unless linked to policy |
| [`readiness/`](./readiness/) | Gate inputs, required evidence sets, generated readiness references, and stable signoff contracts | Updated with gate contracts | Yes where stated |
| [`evidence/`](./evidence/) | Candidate-specific scans, audits, install results, matrices, run IDs, and signoff records | Point-in-time | No; evidence of a contract, not a contract itself |

## Policy

- [Cross-platform release policy](./policy/cross-platform.md)
- [npm registry policy](./policy/npm-registry.md)
- [NuGet policy](./policy/nuget.md)

## Channels

- [Public Preview](./channels/public-preview.md)

## Readiness contracts

- [Avalonia stable readiness](./readiness/avalonia-stable.md)
- [Avalonia performance budgets](./readiness/avalonia-performance-budgets.md)
- [Active platform overrides](./readiness/platform-overrides.md)

## Evidence records

- [npm Public Preview evidence](./evidence/npm-public-preview/)
- [Public Preview repository evidence](./evidence/public-preview/)
- [Avalonia preview evidence](./evidence/avalonia-preview/)
- [Avalonia stable evidence](./evidence/avalonia-stable/README.md)

## Placement rules

1. Put durable release rules in `governance.md` or `policy/`; never in an evidence record.
2. Put a release-channel description in `channels/`; do not use a channel note as a registry or compatibility policy.
3. Put required gate inputs and generated readiness references in `readiness/`.
4. Put dated or candidate-specific output in `evidence/<channel-or-platform>/` and record the candidate baseline.
5. Evidence may cite policy and readiness contracts. Policy and readiness contracts may point to current evidence, but evidence must not redefine their requirements.
6. Generated readiness files must name their generator and must be regenerated rather than edited by hand.
7. Historical evidence remains immutable except for path migration, factual correction, or an explicit supersession notice.
