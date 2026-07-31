# Avalonia Platform Differences

Avalonia uses native controls, Skia text rendering, resource dictionaries, and
automation peers instead of browser DOM, CSS, SVG, and ARIA primitives. Stable
contracts keep public props, events, values, keyboard behavior, and accessible
names equivalent while allowing documented rendering and host differences.

## Registered Overrides

Every accepted override below is backed by `spec/platform-overrides/`.

| Override ID                             | Component area    | Adoption rule                                                                                                            |
| --------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| accessibility-automation-name-001       | icon-button       | Use `AccessibleName` or visible labels; do not document Web ARIA attributes as Avalonia API.                             |
| avalonia-control-template-native-001    | controls          | Treat templates as native Avalonia implementation detail while preserving public state and events.                       |
| avalonia-icon-streamgeometry-001        | icon              | Use `FsusIconKeys` and generated `StreamGeometry` resources instead of SVG component imports.                            |
| avalonia-layout-panel-measure-001       | layout-primitives | Expect measure/arrange differences from Web flex and grid; preserve gap, order, and scroll intent.                       |
| avalonia-date-time-native-picker-001    | date-time-pickers | Native date and time presenters may differ while values, clear behavior, shortcuts, and locale formatting remain stable. |
| scroll-anchoring-avalonia-presenter     | virtual-list      | Avalonia scroll presenters can correct offsets after measure; anchor identity and realized budgets remain stable.        |
| avalonia-linux-window-shadow-001        | dialog            | Linux compositor shadows can differ; modality, focus trap, dismissal, and announced names stay equivalent.               |
| avalonia-linux-font-rasterization-001   | text              | Linux font fallback and Skia rasterization can shift baselines within the typography threshold.                          |
| avalonia-macos-text-smoothing-001       | text              | macOS smoothing can differ while content, wrapping, and accessible names stay equivalent.                                |
| avalonia-windows-focus-ring-001         | focus-visible     | Windows high-contrast focus cues may override app brushes while keyboard focus state remains equivalent.                 |
| avalonia-windows-font-rasterization-001 | text              | Windows DirectWrite fallback can shift glyph width within the typography threshold.                                      |
| web-browser-font-baseline-001           | text              | Browser and Skia line metrics are compared by content order, wrapping intent, and accessible names.                      |
| visual-token-color-001                  | button            | Tokenized color variance must not change state meaning, contrast intent, or token role semantics.                        |
| visual-text-baseline-001                | text              | Text baselines may vary within the shared visual threshold.                                                              |

## Native Adapter Classifications

| Component area                                                  | Classification | Shared contract                                                                                                                                                            | Native boundary                                                                                                                                                                     |
| --------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MarkdownEditor transaction, selection, history, and composition | native-adapter | Preserve ordered non-overlapping changes, revision rejection, bounded change/inverse history, selection direction, external reset, and one composition-complete undo unit. | Web uses textarea UTF-16 offsets and DOM composition events; Avalonia must map native text/IME APIs to the same public semantics without exposing DOM or a private editor instance. |

## Documentation Rule

Component docs must name supported platform differences and link callers back
to this page. New accepted overrides must be added here before the docs gate
passes.
