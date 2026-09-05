# WebView adapter

> **Role:** Avalonia public API contract
> **Applies to:** Applications that host an embedded browser through an
> application-selected backend
> **Authority:** Applies the platform-neutral API and design boundaries in
> [`docs/design.md`](../../design.md) and
> [`docs/avalonia/platform-differences.md`](../platform-differences.md).

## Avalonia API

`FsusWebViewAdapter` is a platform-neutral facade over an
application-supplied `IFsusWebViewBackendAdapter`. It is not a WebView control,
does not create an embedded-browser shell, and does not expose DOM selectors or
browser-engine objects. The consuming application remains responsible for
selecting and mounting its browser backend.

The backend raises `ContextMenuRequested` with a
`FsusWebViewContextMenuRequest`. The request identifies pointer or keyboard
origin, finite viewport coordinates, editable and selection state, image
content, supported edit actions, and optional spelling data. It contains only
FsusUI value types.

`OpenContextMenu` composes the request into the existing `FsusContextMenu`
primitive. It preserves the primitive's Light/Dark resources, keyboard
navigation, automation roles, Escape and outside dismissal, and invoker focus
restoration. `FsusWebViewContextMenuLabels` lets an application localize all
visible labels without changing command keys. When spelling data is absent,
the system spelling-menu action is shown only if both the request and backend
advertise that escape hatch.

```csharp
using var adapter = new FsusWebViewAdapter(applicationBackend);
adapter.ContextMenuRequested += (_, args) =>
{
  adapter.OpenContextMenu(
    overlayHost,
    editorMenu,
    args.Request,
    embeddedBrowserHost,
    localizedLabels);
};
```

The edit commands are `Cut`, `Copy`, `Paste`, `RichCopy`, `CopyHtml`,
`PastePlainText`, `InsertParagraph`, `ReplaceWord`, `AddToDictionary`, and
`UseNativeMenu`. Backend implementations keep the corresponding DOM command or
native API inside the backend boundary.

## Vue Contract Mapping

Browser context-menu, spelling, developer-tools, and PDF intents map to typed
facade requests and capability/result records. This adapter does not expose a
Vue component alias, DOM selector, or browser-engine type.

## Spelling and developer tools

`FsusWebViewCapabilities` separately advertises spelling suggestions,
replacement, dictionary insertion, and native-menu fallback. A backend must
not populate a capability merely because its private implementation contains a
similar hook.

`OpenDeveloperToolsAsync` is a platform-neutral debug command. A debug backend
advertises `DeveloperTools` only when it can open its tools through a supported
public integration. Production and unsupported backends leave the capability
false; the facade then returns an explicit `Unsupported` result without
invoking the backend. Consumers must not use reflection or depend on private
WebView2, WebKit, Chromium, or other engine implementation types to bypass that
result.

## Tagged PDF and document outline

`ExportPdfAsync` accepts a caller-owned writable stream and
`FsusWebViewPdfExportOptions`. `GenerateTaggedPdf` and
`GenerateDocumentOutline` are preflighted against the discovered backend
capabilities. An unsupported request returns `Unsupported` before the backend
writes to the stream.

Successful outline export must return a non-empty tree of
`FsusWebViewDocumentOutlineNode` values. Every node has an `h1`-through-`h6`
level and a non-empty clickable destination, and every child has a deeper
heading level than its parent. A backend that reports success without proving
positive bytes written, stream growth, the requested PDF structures, and every
returned outline destination is converted to `InvalidBackendResult` rather
than silently accepted. A successful proof therefore requires a readable,
seekable destination; a writable-only stream remains caller-owned but cannot
prove the exported structure and fails closed.

The destination stream always remains caller-owned and open. Cancellation is
observed before backend dispatch and after backend completion. `Theme` carries
the explicit Light or Dark print variant; `PrintBackgrounds` carries the
background choice without exposing backend print-setting types.

## Supported Platform Differences

Windows and Linux adapters may use different embedded-browser engines, but
they expose the same `FsusWebViewPlatform`, capability, command, result, PDF,
and outline types. An unsupported backend reports individual capability
absence. FsusUI does not claim a feature was applied based on operating-system
name alone.

## Theme Tokens

Context menus reuse the shared menu/overlay resources; PDF export carries an
explicit `Theme` variant and `PrintBackgrounds` choice. See [Application
Setup](../installation.md#application-setup) for resource ownership.

## Minimal Avalonia Example

The C# example above is the minimal integration: the application supplies the
backend, overlay host, menu, and localized labels; the adapter owns only the
typed request/result boundary.

## Known Limitations

The adapter does not ship an embedded-browser engine, print dialog, or native
developer-tools implementation. The application must provide a supported
backend and verify engine-specific behavior.

## Accessibility and AOT

Context-menu items use the existing menu and menu-item automation peers,
localized accessible names, enabled state, keyboard traversal, and invoker
focus restoration. The adapter contract uses direct typed calls only; it does
not require reflection, dynamic code generation, or browser-engine metadata
and is compatible with the package's Native AOT boundary.

## Verification boundary

The repository provides deterministic adapter simulations for context-menu,
spelling, developer-tools support and production rejection, Windows/Linux PDF,
cancellation, stream ownership, semantic
`h1`-through-`h6` tag markers, and hierarchical clickable-outline results. Those simulations
verify the public contract and fail-closed behavior; they are not evidence that
an external WebView engine executed in the current environment.
