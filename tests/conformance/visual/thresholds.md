# Visual Thresholds

FsusUI targets contract-perfect consistency with visually bounded variance, not
literal pixel equality across browser engines, Skia, DPI modes, and Linux
compositors.

Initial thresholds:

- color delta: low for tokenized fills and text colors
- spacing delta: low for tokenized spacing, medium for native text metrics
- radius delta: low for generated radius tokens
- text baseline delta: medium across browser and Avalonia font renderers
- screenshot diff percentage: low for same-platform reruns, medium across
  Web/Avalonia comparisons

Any intentional exception must be registered under `spec/platform-overrides/`
with rationale, owner, review date, and test policy.
