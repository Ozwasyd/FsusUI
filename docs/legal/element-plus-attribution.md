# Element Plus Attribution

FsusUI is an Element Plus-derived Vue 3 component library workspace. The
repository keeps much of the Element Plus package structure while adding FsusUI
theme, motion, WASM, Markdown, packaging, documentation, and governance work.

## Upstream License

The repository license is MIT and preserves the upstream Element Plus notice:

```text
Copyright (c) 2020-PRESENT Element Plus
```

The root [`LICENSE`](../../LICENSE), root [`NOTICE`](../../NOTICE), and
`vue/packages/icons-svg/LICENSE` document this license lineage.

## FsusUI Ownership Boundary

FsusUI-specific changes are maintained by Ozwasyd. This includes:

- FsusUI public-preview documentation and release evidence.
- Theme token, motion token, and visual-system changes.
- WASM and Markdown runtime integration work.
- npm public publishing policy.
- Demo app wiring, visual regression coverage, and contribution workflow.

Element Plus compatibility is best-effort unless covered by local tests or
public FsusUI docs. See
[`docs/element-plus-compatibility.md`](../element-plus-compatibility.md).

## Asset Policy

Code, generated package artifacts, and icon sources are covered by the MIT
license unless a file states otherwise.

Public demo screenshots and visual regression snapshots are synthetic
repository verification fixtures. They must not contain private screenshots,
real user data, private paths, customer names, private package mirrors, or
token-bearing configuration.

Brand names, logos, or product screenshots that are not synthetic fixtures need
an explicit asset policy before they can be added to the public repository.

## Package Naming

The active public-preview package name is `@ozwasyd/element-plus`. The internal
workspace package still uses `element-plus` naming for compatibility with the
existing source layout. Long-term naming policy is documented in
[`docs/releases/policy/npm-registry.md`](../releases/policy/npm-registry.md).
