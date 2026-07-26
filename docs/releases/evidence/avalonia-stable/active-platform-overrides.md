# Active platform overrides

## Active platform overrides

Accepted overrides are tracked in `spec/platform-overrides/` and summarized in
`docs/avalonia/platform-differences.md`.

| Override id | Stable impact |
| --- | --- |
| `accessibility-automation-name-001` | Web ARIA names and Avalonia automation names expose the same user-facing names. |
| `avalonia-control-template-native-001` | Native Avalonia templates may differ internally while public state and events remain stable. |
| `avalonia-icon-streamgeometry-001` | Avalonia uses `StreamGeometry` resources for registry icons. |
| `avalonia-layout-panel-measure-001` | Avalonia measure/arrange differs from Web flex/grid within documented thresholds. |
| `avalonia-date-time-native-picker-001` | Native date/time presenters preserve public value and locale contracts. |
| `scroll-anchoring-avalonia-presenter` | ScrollPresenter offset correction preserves anchor identity and realized budgets. |
| `avalonia-linux-window-shadow-001` | Linux compositor shadows may differ while modality and focus remain stable. |
| `avalonia-linux-font-rasterization-001` | Linux font rasterization can vary within text thresholds. |
| `avalonia-macos-text-smoothing-001` | macOS smoothing can vary while wrapping and names remain stable. |
| `avalonia-windows-focus-ring-001` | Windows high-contrast focus cues may override app brushes. |
| `avalonia-windows-font-rasterization-001` | Windows DirectWrite fallback can shift glyph width within thresholds. |
| `web-browser-font-baseline-001` | Browser and Skia line metrics are compared by intent and accessible name. |
| `visual-token-color-001` | Tokenized color variance cannot change state meaning or contrast intent. |
| `visual-text-baseline-001` | Text baseline variance is bounded by the shared visual threshold. |
