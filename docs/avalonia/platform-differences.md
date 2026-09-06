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
| avalonia-macos-shortcut-display-001     | input             | macOS displays Command/Option for the stable platform-neutral shortcut semantics serialized as Ctrl/Alt.                  |
| avalonia-macos-native-menu-role-001     | menu              | macOS application and Dock roles remain explicit in the neutral model and degrade deterministically elsewhere.            |
| avalonia-windows-focus-ring-001         | focus-visible     | Windows high-contrast focus cues may override app brushes while keyboard focus state remains equivalent.                 |
| avalonia-windows-font-rasterization-001 | text              | Windows DirectWrite fallback can shift glyph width within the typography threshold.                                      |
| web-browser-font-baseline-001           | text              | Browser and Skia line metrics are compared by content order, wrapping intent, and accessible names.                      |
| visual-token-color-001                  | button            | Tokenized color variance must not change state meaning, contrast intent, or token role semantics.                        |
| visual-text-baseline-001                | text              | Text baselines may vary within the shared visual threshold.                                                              |
| visual-markdown-source-surface-002      | markdown-editor   | Dense CJK source text may rasterize with sub-pixel glyph placement differences; structure, wrapping, and token colors must match.                                                        |
| visual-vue-parity-batch3-text-003       | all               | Element-level alert, tag, progress, badge, breadcrumb, and switch crops concentrate glyph anti-aliasing and sub-pixel offsets; bounds, stripe/dot/fill geometry, and token colors must match. |

## Native Adapter Classifications

| Component area                                                  | Classification | Shared contract                                                                                                                                                            | Native boundary                                                                                                                                                                     |
| --------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MarkdownEditor transaction, selection, history, and composition | native-adapter | Preserve ordered non-overlapping changes, revision rejection, bounded change/inverse history, selection direction, external reset, and one composition-complete undo unit. | Web uses textarea UTF-16 offsets and DOM composition events; Avalonia must map native text/IME APIs to the same public semantics without exposing DOM or a private editor instance. |
| MarkdownEditor search, outline, export, print, and writing aids | native-adapter | Preserve revision-bound search/outline identities, projection highlights, fail-closed reveal, canonical renderer HTML, opt-in Focus, and upper-third Typewriter state. | Avalonia hosts bridge canonical search/render output and platform printing through typed contracts; the control keeps native selection/scroll ownership and does not expose DOM, WebView, parser, or print-engine types. |
| CodeEditor input, coordinates, history, and composition          | native-adapter | Preserve UTF-16 offsets, one-based line/column conversion, identity-isolated history, explicit external/user change origins, and one composition-complete undo unit.         | Avalonia uses one native `TextBox` as the IME, clipboard, and input owner while the bounded FsusUI presentation draws Markdown source highlighting and line numbers.            |
| ShortcutRecorder key capture and display                        | native-adapter | Preserve strongly typed key combinations, stable serialization string, cancellation, clearing, and collision detection.                                                    | macOS displays Command/Option symbols while Windows/Linux displays Ctrl/Alt text; underlying key codes and serialized semantics remain stable.                                      |
| NativeMenu and platform roles                                   | native-adapter | Unified command model for native menus, command palette, and dock menus with synchronous enabled and gesture update.                                                      | macOS registers the Services submenu through Avalonia's native exporter and sends declared application/window actions through the responder chain; those roles degrade gracefully on Windows and Linux, where platform-standard File/Edit/View/Window/Help ordering is preserved. |
| WebView context, spelling, developer tools, and PDF export      | native-adapter | Preserve typed context requests, edit commands, capability discovery, the debug-only developer-tools result, caller-owned streams, tagged-PDF proof, and hierarchical clickable outline semantics. | Applications select the embedded-browser backend. Private developer-tool hooks, engine selectors, and native print-setting objects remain inside that backend; consumers do not use reflection or engine types. |
| Desktop title bar and document cycling                          | native-adapter | Preserve typed title/path/status/actions, drag/no-drag regions, window actions and state, and forward/reverse document cycling.                                           | Windows/Linux can use embedded window buttons; macOS hosts retaining native traffic lights hide embedded buttons. Meta maps to Command while Control remains the neutral fallback.   |

## Desktop Shell Window Behavior

[`docs/avalonia/components/desktop-shell.md`](components/desktop-shell.md)
defines the public activity rail, document tabs, and title-bar APIs. Window
decoration and fullscreen animation remain native:

- Windows uses extended-client-area composition and may replace focus resources
  in high contrast.
- macOS consumers that retain native traffic lights hide the embedded window
  controls; Meta represents the Command modifier for document cycling.
- Linux support depends on the current X11/Wayland compositor accepting
  extended-client-area drag and requested window state.

These host differences do not change typed action events, selected/dirty
automation state, contextual-pane width bounds, or the no-drag attached
property. They do not introduce a third theme preset or an unregistered token.

## Documentation Rule

Component docs must name supported platform differences and link callers back
to this page. New accepted overrides must be added here before the docs gate
passes.
