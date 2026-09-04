# FsusUI.Avalonia.Icons

`FsusUI.Avalonia.Icons` provides Avalonia icon resources generated from
`spec/icons/registry.yaml`.

For adoption setup, package references, and clean sample verification, see
[`docs/avalonia/installation.md`](../../docs/avalonia/installation.md).

## Trimming and AOT

This package is an AOT-compatible library with trimming, single-file, and AOT
analyzers enabled. The generated icon dictionary remains on the normal package
resource path; there is no AOT-only icon path or public API. The library
contract does not set `PublishAot` or validate a final RID-specific Native AOT
executable. Consuming applications and third-party plugins must verify their
own dynamic loading and reflection boundaries.

## Import

```xml
<Application.Resources>
  <ResourceInclude Source="avares://FsusUI.Avalonia.Icons/Generated/FsusIcons.axaml" />
</Application.Resources>
```

Use `FsusIconKeys` for stable lookup instead of hard-coded resource keys.
`docs/icons/generated/stable-icons.md` lists the matching Vue component and
Avalonia resource key for every stable icon.
`FsusUI.Avalonia.Controls.FsusIcon` can consume these resources through
`IconKey` plus `Data="{StaticResource ...}"` without changing the generated
source set.

## File Type Resolution

`FsusUI.Avalonia.Icons.FsusFileTypeIcon` maps a file name or bare extension to
a stable generated resource key for compact tree rows and content presenters:

```csharp
icon.IconKey = FsusFileTypeIcon.Resolve("README.md");   // FsusIconFileMarkdown
icon.IconKey = FsusFileTypeIcon.Resolve("archive.tar.gz"); // FsusIconFileArchive
icon.IconKey = FsusFileTypeIcon.Resolve("unknown.zzz"); // FsusIconFile (stable fallback)
```

The resolver distinguishes Markdown, plain text, code, data, image, archive,
and document formats, and returns the stable `FsusIconFile` fallback for
unknown, empty, or hidden inputs such as `Makefile`. Compound names use the
last extension. Use `TryResolve` when the consumer must know that the fallback
was applied.

Pair every resolved icon with the row's visible file name label; the icon is
decorative by default and must not duplicate the file name as an automation
name. Icons inherit the host foreground color in every theme.

## Semantics

Icon size, stroke, and fill names come from shared token ids:

- `icon.size.md`
- `icon.stroke.md`
- `icon.fill.default`

The generated XAML stores vector resources only. The icon pipeline validates
that each Avalonia `StreamGeometry` matches the same SVG path data used by the
Vue component. Controls remain responsible for applying tokenized size, stroke,
fill, foreground color, and accessibility names.

## Accessibility

Decorative icons must not add redundant automation names. Semantic icons must
be paired with a visible label or `AutomationProperties.Name`. Icon-only
buttons must provide a stable accessible name through
`FsusIconButton.AccessibleName` or explicitly set
`FsusIconButton.IsDecorativeIcon`. Loading states must not replace that name
with spinner-only content.
