# Cross-Platform API Boundary

The cross-platform public contract lives in `spec/`, generated artifacts, and
documented package APIs.

## Public

- platform-neutral tokens and generated token artifacts
- component contracts under `spec/components/`
- documented Web component APIs
- documented Markdown runtime projection consumers on `@ozwasyd/element-plus/markdown-runtime`
- documented Avalonia controls under `FsusUI.Avalonia`
- documented theme resources under `FsusUI.Avalonia.Themes`

## Not Public

- undocumented Element Plus classes, CSS selectors, DOM structure, package
  internals, or generated build paths
- Avalonia template internals, private resource keys, control template parts, or
  implementation-only XAML structure
- product integrations such as FsusBlog or FsusPanel business state
- Web-only WASM runtime paths other than the documented `/markdown-runtime` projection consumers

Product integrations must consume public FsusUI packages and contracts rather
than implementation internals. Platform-specific implementation details can be
mapped in adapters, but they must not become the source cross-platform contract.
