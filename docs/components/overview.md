# Component Overview

FsusUI provides Vue 3 components for controls, forms, data display, navigation,
feedback, Markdown surfaces, and public-page shells. Each component page is the
canonical local reference for its documented API, examples, and limitations.

Run the interactive examples in the [Playground](../playground.md). Public API
stability is defined by [API stability](../api-stability.md); shared theme and
motion behavior is defined by the [theme token](../theme/tokens.md) and
[motion token](../theme/motion.md) contracts.

## Basic components

| Component | Purpose |
| --- | --- |
| [Button](./button.md) | Actions with type, state, and size variants. |
| [Icon](./icon.md) | SVG icon components and registration. |
| [Link](./link.md) | Text links with type and underline control. |
| [Text](./text.md) | Semantic text with truncation support. |
| [Scrollbar](./scrollbar.md) | Custom scroll containers. |
| [Space](./space.md) | Consistent spacing between adjacent elements. |
| [Layout](./layout.md) | Responsive 24-column layout. |
| [Divider](./divider.md) | Separates related content. |
| [Motion](./motion.md) | Semantic presets, directives, recipes, and transitions. |

## Form components

| Component | Purpose |
| --- | --- |
| [Input](./input.md) | Single-line and multiline text input. |
| [InputNumber](./input-number.md) | Numeric input with step and precision controls. |
| [Select](./select.md) | Single- or multi-option selection. |
| [Select V2](./select-v2.md) | Virtualized selection for large option sets. |
| [Radio](./radio.md) | Single-choice controls. |
| [Checkbox](./checkbox.md) | Multiple-choice controls. |
| [Cascader](./cascader.md) | Hierarchical option selection. |
| [Form](./form.md) | Form layout, validation, and submission. |
| [DatePicker](./date-picker.md) | Date and date-range selection. |
| [TimePicker](./time-picker.md) | Arbitrary time and time-range selection. |
| [TimeSelect](./time-select.md) | Selection from predefined time slots. |
| [Switch](./switch.md) | Toggle between two states. |
| [Slider](./slider.md) | Select a value or range by dragging. |
| [Upload](./upload.md) | Click, drag, and directory uploads. |
| [Rate](./rate.md) | Rating input. |
| [ColorPicker](./color-picker.md) | Color selection with optional alpha. |
| [Transfer](./transfer.md) | Move items between two lists. |

## Data display

| Component | Purpose |
| --- | --- |
| [Table](./table.md) | Structured data with sorting, filtering, selection, and trees. |
| [Table V2](./table-v2.md) | Virtualized tables for large data sets. |
| [VirtualList](./virtual-list.md) | Virtual scrolling with optional WASM row estimation. |
| [Pagination](./pagination.md) | Paginate large result sets. |
| [Tree](./tree.md) | Expandable hierarchical data. |
| [Tree V2](./tree-v2.md) | Virtualized hierarchical data. |
| [TreeSelect](./tree-select.md) | Select values from a tree. |
| [Autocomplete](./autocomplete.md) | Text input with suggestions. |
| [Avatar](./avatar.md) | User or object avatars. |
| [Badge](./badge.md) | Numeric or status markers. |
| [Calendar](./calendar.md) | Date display and selection. |
| [Card](./card.md) | Content grouping in a surface. |
| [Carousel](./carousel.md) | Cycled presentation of related content. |
| [Collapse](./collapse.md) | Collapsible content panels. |
| [Countdown](./countdown.md) | Countdown values. |
| [Descriptions](./descriptions.md) | Key-value data descriptions. |
| [Empty](./empty.md) | Empty-state placeholder. |
| [Image](./image.md) | Lazy loading, placeholders, errors, and preview entry points. |
| [ImageViewer](./image-viewer.md) | Full-screen image preview, zoom, and navigation. |
| [InfiniteScroll](./infinite-scroll.md) | Trigger loading at a scroll boundary. |
| [Statistic](./statistic.md) | Prominent metrics and values. |
| [Tag](./tag.md) | Lightweight labels and selectable tags. |
| [Timeline](./timeline.md) | Time-ordered content. |
| [Watermark](./watermark.md) | Text or image watermark overlays. |
| [Skeleton](./skeleton.md) | Loading placeholders. |

## Navigation

| Component | Purpose |
| --- | --- |
| [Menu](./menu.md) | Navigation menus and routing modes. |
| [Tabs](./tabs.md) | Switch between related content panes. |
| [Breadcrumb](./breadcrumb.md) | Show the current path. |
| [PageHeader](./page-header.md) | Heading and back-navigation affordances. |
| [Dropdown](./dropdown.md) | Compact action or menu lists. |
| [Steps](./steps.md) | Guide users through a process. |
| [Affix](./affix.md) | Pin content within a viewport or container. |
| [Backtop](./backtop.md) | Return to the top of a page. |

## Feedback

| Component | Purpose |
| --- | --- |
| [Alert](./alert.md) | Important inline messages. |
| [Dialog](./dialog.md) | Focused tasks without leaving the current page. |
| [Drawer](./drawer.md) | Temporary edge panels. |
| [Loading](./loading.md) | Local and full-screen loading states. |
| [Message](./message.md) | Short operation feedback. |
| [MessageBox](./message-box.md) | Modal alert, confirmation, and prompt flows. |
| [Notification](./notification.md) | Non-blocking global notifications. |
| [Popover](./popover.md) | Contextual floating content. |
| [Popconfirm](./popconfirm.md) | Confirmation anchored to an action. |
| [Tooltip](./tooltip.md) | Hover or focus help text. |
| [Progress](./progress.md) | Determinate and indeterminate progress. |
| [Result](./result.md) | Task outcome feedback. |

## Specialized surfaces and primitives

| Component | Purpose |
| --- | --- |
| [Collection Primitives](./collection-primitives.md) | Collection toolbars, filters, lists, and empty states. |
| [Empty State](./empty-state.md) | Inline, compact, and page-level empty states. |
| [Inbox Primitives](./inbox-primitives.md) | Inbox layout, panes, context, and reply composition. |
| [MarkdownEditor](./markdown-editor.md) | Transactional Markdown editing and writing aids. |
| [MarkdownRenderer](./markdown-renderer.md) | Safe, feature-activatable Markdown rendering. |
| [Metric Primitives](./metric-primitives.md) | Metric lists, distributions, and diagnostics. |
| [PerceptionChallenge](./perception-challenge.md) | Protocol-neutral challenge and interaction primitives. |
| [PublicShell](./public-shell.md) | Public-page navigation and responsive shell layout. |
| [Settings Primitives](./settings-primitives.md) | Settings sections, resource lists, and confirmations. |
| [SiteHeader](./site-header.md) | Site header and primary navigation surface. |
| [TaskPageHeader](./task-page-header.md) | Canonical heading grammar for task surfaces. |
| [ConfigProvider](./config-provider.md) | Global locale, size, z-index, theme, and runtime configuration. |
