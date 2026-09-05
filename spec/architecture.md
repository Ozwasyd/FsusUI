# FsusUI Specification Architecture

FsusUI is maintained as a design system with separate implementation targets:

```txt
spec/
  -> generated artifacts
  -> Web/Vue implementation
  -> Avalonia implementation
  -> product integrations
```

## Layer Responsibilities

| Layer                   | Owns                                                        | Must not own                                          |
| ----------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| Specification           | Names, contracts, states, token semantics, UX patterns      | Runtime framework code, DOM selectors, XAML templates |
| Generated artifacts     | Mechanical platform output from spec tokens and contracts   | Hand-authored visual decisions                        |
| Web implementation      | Vue components, Element Plus compatibility, CSS integration | Cross-platform source contracts                       |
| Avalonia implementation | XAML resources, control themes, .NET packaging              | Web DOM structure or Element Plus internals           |
| Product integration     | Product routing, data, copy, feature workflows              | Core design-system contracts                          |

## Dependency Direction

Web and Avalonia may both depend on `spec/` and generated artifacts, but must not
depend on each other. Product apps depend only on published FsusUI packages and
documented contracts.

Allowed:

- Web CSS variables generated from platform-neutral tokens
- Avalonia resources generated from the same token names
- product pages using public components, directives, composables, and tokens
- documented platform overrides with owner, reason, and conformance expectation

Not allowed:

- Avalonia consuming Vue component files or Element Plus class names
- Web consuming Avalonia resource keys as source contracts
- product apps targeting undocumented CSS selectors or XAML template parts
- using motion or color values that bypass the token source without an override

## Conformance Strategy

Consistency is proven by:

- token checksums and stale artifact checks
- contract tests for public props, states, events, and content regions
- keyboard and pointer scenario traces
- accessibility mappings for each target platform
- visual regression thresholds that allow documented platform differences

Platform differences are acceptable only when they are registered in
[`platform-overrides/`](./platform-overrides/README.md).
