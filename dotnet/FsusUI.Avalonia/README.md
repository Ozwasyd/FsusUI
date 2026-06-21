# FsusUI.Avalonia

`FsusUI.Avalonia` contains the shared Avalonia control wrappers and constants
used by the preview Avalonia packages.

This package is generated and tested as part of the cross-platform FsusUI
workspace. It does not expose Web DOM structure, Element Plus internals, or
product-specific FsusPanel/FsusBlog contracts.

## Button Controls

`FsusButton` is the stable command control for Avalonia. It exposes typed
variant, size, loading, text/link/plain/round/circle, inline action, icon
placement, custom brush, automation name, command, and routed activation
semantics. Loading buttons suppress `Click`, `Command`, and `Activated` output
until loading clears.

`FsusButtonGroup` groups `FsusButton` children with shared size/variant,
deterministic first/middle/last membership classes, collapsed borders, and
disabled-state propagation that restores each child to its prior enabled state.

`FsusIconButton` is the icon-only action surface. It inherits command,
disabled/loading, and routed `Activated` behavior from `FsusButton`, applies the
icon-only placement classes, and requires `AccessibleName` unless
`IsDecorativeIcon` is set.

## Icon, Text, and Link Controls

`FsusIcon` renders an Avalonia `Geometry` through the existing stable icon
resources. Set `IconKey` to the generated resource key and optionally bind
`Data` from `FsusUI.Avalonia.Icons`. Decorative icons default to raw automation
view; semantic icons must set `AccessibleName` and `IsDecorative=false`.

`FsusText` is the stable text primitive for body, muted, strong, title, and
monospace variants. `IsTruncated` applies single-line ellipsis behavior without
changing the row height contract.

`FsusLink` is a command-capable text action with `NavigateUri`, inherited
`Activated` routing, disabled-state blocking, and automation naming from either
`AccessibleName` or string content.

## Input Controls

`FsusInput` extends Avalonia `TextBox` with stable size, invalid, clearable,
prefix/suffix content, automation name, `ValueChanged`, `Cleared`, and IME
composition guards. `BeginImeComposition`, `UpdateImeComposition`, and
`CommitImeComposition` keep partial composition text from emitting committed
value changes.

`FsusTextarea` uses the same value, clear, automation, prefix/suffix, readonly,
disabled, and invalid semantics while enabling multiline return input and
wrapping defaults.

`FsusInputNumber` adds nullable decimal `Value`, `Minimum`, `Maximum`, `Step`,
spin controls, text commit parsing, and clamping. Increment/decrement operations
respect readonly and disabled states.

## Selection Controls

`FsusCheckbox` supports checked, unchecked, and indeterminate states through
nullable `IsChecked`, `IsIndeterminate`, `IsThreeState`, `ItemValue`,
`AccessibleName`, `IsLoading`, keyboard Space toggling, and `ValueChanged`.
Automation metadata maps to checkbox semantics and reports checked,
unchecked, or indeterminate item status.

`FsusCheckboxGroup` owns `FsusCheckbox` children and exposes deterministic
`SelectedValues` ordering based on child order. Disabled children cannot be
toggled by keyboard or pointer interaction, and group disabled state restores
each child to its prior enabled state.

`FsusRadio` and `FsusRadioGroup` provide item-value selection with Space,
Arrow, Home, and End keyboard navigation. `SelectedValue` updates exactly one
enabled item and skips disabled or loading radios during roving navigation.

`FsusSwitch` exposes boolean `IsChecked`, `AccessibleName`, `IsLoading`, Space
toggling, and `ValueChanged`. Loading state blocks interaction, publishes
automation item status, and restores the previous enabled state when loading
clears.

## Overlay Host

`FsusOverlayHost` provides the shared host for stable overlay surfaces. It
tracks deterministic z-order, modal stack state, pointer/keyboard dismissal,
focus containment, focus restoration, and viewport-aware placement. Use
`FsusOverlayHostService` to keep one host per window or top-level surface.

See `docs/avalonia/overlay-host.md` for host setup and close-policy details.
