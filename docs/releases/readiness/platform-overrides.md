# Active Platform Overrides

> **Role:** Generated stable-readiness reference
> **Generator/validator:** `scripts/check-platform-overrides.mjs` and `spec/platform-overrides/*.yaml`

This generated readiness reference lists accepted platform differences required by stable release checks. The
source of truth remains `spec/platform-overrides/*.yaml`; CI verifies every
active override id appears here.

| ID                                        | Component              | Platform         | Visual Threshold | Test Policy                                             | Review After |
| ----------------------------------------- | ---------------------- | ---------------- | ---------------- | ------------------------------------------------------- | ------------ |
| `accessibility-automation-name-001`       | button, icon           | all              | none             | accessibility-contract                                  | 2026-12-01   |
| `avalonia-control-template-native-001`    | button, input, select  | avalonia         | low              | contract-and-accessibility                              | 2026-12-01   |
| `avalonia-date-time-native-picker-001`    | date/time pickers      | avalonia         | low              | contract-visual-and-accessibility                       | 2026-12-01   |
| `avalonia-icon-streamgeometry-001`        | icon                   | avalonia         | low              | icon-alignment-threshold                                | 2026-12-01   |
| `avalonia-layout-panel-measure-001`       | layout primitives      | avalonia         | medium           | layout-geometry-threshold                               | 2026-12-01   |
| `avalonia-linux-window-shadow-001`        | dialog                 | avalonia-linux   | medium           | visual-threshold                                        | 2026-12-01   |
| `avalonia-linux-font-rasterization-001`   | text                   | avalonia-linux   | medium           | typography-baseline-threshold                           | 2026-12-01   |
| `avalonia-macos-native-menu-role-001`     | menu                   | avalonia-macos   | low              | local-platform-role-simulation-and-native-menu-contract | 2026-11-01   |
| `avalonia-macos-shortcut-display-001`     | input                  | avalonia-macos   | low              | headless-interaction-and-local-platform-simulation      | 2026-11-01   |
| `avalonia-macos-text-smoothing-001`       | text                   | avalonia-macos   | medium           | visual-threshold                                        | 2026-12-01   |
| `avalonia-windows-font-rasterization-001` | text                   | avalonia-windows | medium           | typography-baseline-threshold                           | 2026-12-01   |
| `avalonia-windows-focus-ring-001`         | button, input          | avalonia-windows | low              | accessibility-and-visual-threshold                      | 2026-12-01   |
| `scroll-anchoring-avalonia-presenter`     | virtual-list, table-v2 | avalonia         | low              | virtualization-anchor-and-budget-contract               | 2026-10-01   |
| `visual-text-baseline-001`                | text                   | all              | medium           | text-baseline-threshold                                 | 2026-12-01   |
| `visual-vue-parity-batch3-text-003`       | all                    | all              | medium           | pixelmatch-plus-lab                                     | 2026-11-01   |
| `visual-markdown-source-surface-002`      | markdown-editor        | all              | medium           | pixelmatch-plus-lab                                     | 2026-10-01   |
| `visual-token-color-001`                  | button                 | all              | low              | color-delta                                             | 2026-12-01   |
| `web-browser-font-baseline-001`           | text                   | web              | medium           | visual-threshold                                        | 2026-12-01   |
