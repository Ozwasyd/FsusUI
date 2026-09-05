# Platform Overrides

Platform differences are allowed only when explicit and testable.

Each override entry must include:

`id`, affected component, affected contract id, affected platform, reason,
visual threshold, behavior expectation, conformance test expectation, owner, and
review date.

Override entries must not become a private second design system. If the same
override is needed repeatedly, promote the behavior back into the neutral spec.

## Acceptable Difference Families

The registry may accept bounded differences for:

- font rasterization and text baseline differences between browser engines and Skia
- Skia, browser, compositor, and OS rendering differences for shadows,
  antialiasing, clipping, and DPI scaling
- operating-system accessibility behavior, including high-contrast focus cues
  and automation API naming
- device pixel ratio, compositor, and monitor scaling variance
- native picker and popup behavior when the public contract keeps equivalent
  props, events, keyboard behavior, and accessibility mapping

Every accepted difference must point to a valid contract id in
`spec/components/contracts/v1/vue-public-contracts.json`, include a future
`reviewAfter` date, and appear in the stable release evidence.
