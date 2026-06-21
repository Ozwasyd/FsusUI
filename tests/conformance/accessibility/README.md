# Accessibility conformance harness

`pnpm run a11y:generate` builds deterministic automation evidence from
`contracts.json` and `automation-snapshots.json`.

The contract file records the required accessibility fields for stable controls:
accessible name, role, value, disabled state, selected state, checked state,
expanded state, invalid state, and keyboard navigation. Automation snapshots
record Avalonia headless output plus the release-gate Appium runners for Windows
and macOS.

`pnpm run conformance:a11y` verifies contract coverage, automation evidence,
keyboard operability, tab order, generated headless test rows, and registered
platform overrides. Stable controls cannot pass with visual evidence alone.

Behavior notes:

- Icon-only controls require a user-facing accessible name.
- Decorative icons use raw accessibility view and must not duplicate the host
  control name.
- Loading controls expose disabled/busy semantics and remain keyboard safe.
- Validation states must be programmatic, not only visual.
- Modal overlays must expose dialog semantics and trap focus while open.
- Live regions use alert/status output for async completion or destructive
  feedback.
