# Active Platform Overrides

This file is stable release evidence for accepted platform differences. The
source of truth remains `spec/platform-overrides/*.yaml`; CI verifies every
active override id appears here.

| ID                                        | Component             | Platform         | Visual Threshold | Test Policy                        | Review After |
| ----------------------------------------- | --------------------- | ---------------- | ---------------- | ---------------------------------- | ------------ |
| `accessibility-automation-name-001`       | button, icon          | all              | none             | accessibility-contract             | 2026-09-01   |
| `avalonia-control-template-native-001`    | button, input, select | avalonia         | low              | contract-and-accessibility         | 2026-09-01   |
| `avalonia-icon-streamgeometry-001`        | icon                  | avalonia         | low              | icon-alignment-threshold           | 2026-09-01   |
| `avalonia-linux-window-shadow-001`        | dialog                | avalonia-linux   | medium           | visual-threshold                   | 2026-09-01   |
| `avalonia-linux-font-rasterization-001`   | text                  | avalonia-linux   | medium           | typography-baseline-threshold      | 2026-09-01   |
| `avalonia-macos-text-smoothing-001`       | text                  | avalonia-macos   | medium           | visual-threshold                   | 2026-09-01   |
| `avalonia-windows-font-rasterization-001` | text                  | avalonia-windows | medium           | typography-baseline-threshold      | 2026-09-01   |
| `avalonia-windows-focus-ring-001`         | button, input         | avalonia-windows | low              | accessibility-and-visual-threshold | 2026-09-01   |
| `visual-text-baseline-001`                | text                  | all              | medium           | text-baseline-threshold            | 2026-09-01   |
| `visual-token-color-001`                  | button                | all              | low              | color-delta                        | 2026-09-01   |
| `web-browser-font-baseline-001`           | text                  | web              | medium           | visual-threshold                   | 2026-09-01   |
