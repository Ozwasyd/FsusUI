# Migrate Vue Contracts To Avalonia

This guide maps Vue/FsusUI product concepts to public Avalonia APIs. Use it
with the per-component pages under [components](components/button.md) and the
registered [platform differences](platform-differences.md).

## Slots

Vue slots become Avalonia `Content`, `Children`, or typed item collections.
Simple default slots map to `ContentControl.Content`; repeated slots should map
to public collections such as navigation items, metric items, rows, or nodes.
Do not port slot names as stringly typed runtime switches.

## Services

Message, notification, loading, and message-box services use explicit host
objects such as `FsusOverlayHost`, `FsusMessageService`,
`FsusNotificationService`, `FsusLoadingService`, and
`FsusMessageBoxService`. Product apps should register one overlay host per
window or top-level surface and pass that host to the service wrapper.

## Directives

Vue directives become explicit controls or service calls. `v-loading` maps to
`FsusLoadingService` or `FsusLoadingOverlay`. Visibility, focus, and scroll
behaviors should be expressed through public Avalonia properties, not DOM
selectors.

## Overlay Behavior

Overlay behavior is host-based. Use `FsusOverlayHost` for z-order, dismissal,
focus restoration, and viewport-aware placement. Dialog, drawer, tooltip,
popover, popconfirm, dropdown, message, notification, and loading surfaces
should not create independent unmanaged windows unless the product shell owns
that window boundary.

## Locale Providers

Vue config providers and locale providers map to
`FsusAvaloniaLocaleProvider`. Use `FsusLocalizedText` for stable built-in keys,
call `SetCulture` for runtime culture changes, and keep product-specific
translations in a registered locale adapter. Missing keys should use the public
fallback escape hatch rather than throwing during layout.

## Migration Checklist

- Replace slot-heavy call sites with `Content`, child controls, or typed item collections.
- Replace services and directives with public Avalonia service helpers and overlay hosts.
- Replace CSS class overrides with theme resources and component properties.
- Replace SVG icon imports with `FsusIconKeys` plus the icon resource dictionary.
- Replace browser-only locale formatting with `FsusAvaloniaLocaleProvider`.
- Rebuild `FsusTabs` through its authoritative `Panes` collection; after
  clearing and adding replacement panes, call `SelectKey` directly without a
  host-owned `ItemsSource` or dispatcher workaround.
- Review [platform differences](platform-differences.md) for native template, typography, focus, and virtualization behavior.
