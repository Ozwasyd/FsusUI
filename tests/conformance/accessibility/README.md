# Accessibility conformance harness

`pnpm run a11y:generate` builds deterministic declaration artifacts from
`contracts.json`, `automation-snapshots.json`, and the runner inputs in
`avalonia-runtime-scenarios.json`. The static snapshots are expectations, not
executed evidence, and provide zero runtime coverage.

The contract file records the required accessibility fields for stable controls:
accessible name, role, value, disabled state, selected state, checked state,
expanded state, invalid state, and keyboard navigation. Automation snapshots
record expected Avalonia semantics plus the release-gate Appium runners for
Windows and macOS.

`pnpm run a11y:check` verifies declaration coverage, keyboard operability, tab
order, generated-source freshness, and registered platform overrides without
requiring .NET. It does not claim runtime coverage.

`pnpm run a11y:runtime` constructs the declared controls under Avalonia
Headless, captures their real `AutomationPeer` and provider trees, binds every
record to the exact Contract V2 registry, Web and Avalonia baselines, runner,
scenario set, source tree, and clean candidate commit, and kills captured role,
name, state, tree, and identity mutations. Unavailable peer fields remain
explicit `null` and make the scenario partial. This headless evidence is not an
OS screen-reader run and is never sufficient to promote cross-platform
alignment.

All 41 declared Avalonia snapshots are runtime inputs. The runner uses an
explicit production-control factory for every row and rejects an omitted,
duplicate, unknown, or unconstructed row. Thirty-three rows also bind an exact
Contract V2 accessibility scenario. The remaining eight still produce real
peer-tree evidence but carry a governed, freshness-checked unbound disposition
and contribute no Contract V2 scenario coverage. `pnpm run conformance:v2`
executes this lane as `execution:avalonia-accessibility`; deleting or
duplicating that root stage fails the static accessibility gate.

An unavailable or mismatched required field must be declared by exact snapshot,
field, and observed value, with a reason, owner, test policy, and review date.
The runtime verifier requires exact set equality: an undeclared missing field
or mismatch, observed-value drift, and a stale declaration all fail. These
entries document implementation gaps; they are not platform overrides or
allow-failures.

`pnpm run conformance:a11y` composes both checks. Stable controls cannot pass
with visual evidence or declaration-only snapshots alone.

Behavior notes:

- Icon-only controls require a user-facing accessible name.
- Decorative icons use raw accessibility view and must not duplicate the host
  control name.
- Loading controls expose disabled/busy semantics and remain keyboard safe.
- Validation states must be programmatic, not only visual.
- Modal overlays must expose dialog semantics and trap focus while open.
- Live regions use alert/status output for async completion or destructive
  feedback.
