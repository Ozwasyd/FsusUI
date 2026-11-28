# Installation

## Requirements

| Tool | Version |
| --- | --- |
| Node.js    | `22.x`    |
| pnpm       | `10.33.0` |
| TypeScript | `6.0.x`   |
| Vue        | `^3.5.0`  |

FsusUI 2.0 ships **pure ESM (`ES2022+`)**. Consumers targeting older browsers
must transpile in their application bundler.

## Install from GitHub Packages

FsusUI 2.0 packages are published to GitHub Packages at
`https://npm.pkg.github.com/`.

Configure the `@ozwasyd` scope in `.npmrc` with a GitHub token that has
`read:packages`, then install `@ozwasyd/fsusui`:

```ini
@ozwasyd:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```bash
pnpm install @ozwasyd/fsusui
```

### Optional Markdown Peer Dependencies

Core components require only `@floating-ui/dom` (installed automatically) and
peer `vue@^3.5.0`. If you use `@ozwasyd/fsusui/markdown` with heavy rendering
features, install only the optional peers you enable:

```bash
pnpm install katex mermaid shiki
```

## Develop in this repository

```bash
pnpm install
pnpm -C vue/packages/demo-app dev
pnpm run build
pnpm run test
```

See [Engineering handoff](../engineering-handoff.md) for the complete command
reference.

## Optional WASM acceleration

FsusUI ships prebuilt WebAssembly artifacts (`ep_wasm`, `markdown_basic`,
`markdown_simd`) with automatic JavaScript fallback. Rebuilding the C++23 WASM
modules requires Emscripten `5.0.4`:

```bash
pnpm run build:wasm
pnpm run check:markdown-wasm
pnpm run check:markdown-wasm-runtime
```

External consumers import the public wrapper `@ozwasyd/fsusui/wasm`.
