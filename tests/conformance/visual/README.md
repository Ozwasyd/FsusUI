# Visual conformance harness

`pnpm run visual:generate` builds deterministic visual comparison artifacts from
`tests/conformance/visual/fixtures/visual-comparisons.json`.

The fixture records the capture runner and artifact path for each side of a
comparison. Web captures must come from Playwright. Avalonia captures must come
from Headless Skia or a real-window runner. Each comparison also declares theme,
density, variant, size, state, locale, direction, and motion mode so fixture
coverage can be reviewed without opening screenshots.

`pnpm run conformance:visual` verifies:

- same-platform reruns use the `samePlatform` threshold set;
- Web/Avalonia comparisons use the `crossPlatform` threshold set;
- geometry, color, radius, spacing, text baseline, screenshot percentage, and
  perceptual deltas stay inside threshold;
- registered platform overrides can allow bounded differences;
- unregistered differences fail and identify component, state, platform, token,
  and screenshot artifact.

Generated baseline and diff JSON files live under
`tests/conformance/visual/artifacts/`.
