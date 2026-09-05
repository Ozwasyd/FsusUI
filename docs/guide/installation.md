# Installation

## Requirements

The repository is maintained against these minimum tool versions:

| Tool | Version |
| --- | --- |
| Node.js    | `22.x`    |
| pnpm       | `10.33.0` |
| TypeScript | `6.0.x`   |
| Vue        | `^3.5.0`  |

FsusUI targets `ES2022`. Consumers must provide equivalent modern browser
support or transpile the package in their application; no older browser
baseline is promised.

### SCSS compiler

The `theme-chalk` SCSS source requires Sass `1.79.0` or newer.

If the terminal reports `legacy JS API Deprecation Warning`, set the modern
compiler API in `vite.config.ts`:

```ts
// vite.config.ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
    },
  },
})
```

## Install from npm

FsusUI public-preview packages are published to the npm public registry at
`https://registry.npmjs.org/`.

Install `@ozwasyd/element-plus`; no project `.npmrc`, scope registry, or GitHub
package token is required.

```bash
pnpm install @ozwasyd/element-plus
```

### Optional Sass source dependency

Install Sass when build-time SCSS variable overrides are needed:

```bash
pnpm install -D sass
```

## Develop in this repository

For component or theme work, use the monorepo workspace directly:

```bash
# 安装全部工作区依赖
pnpm install

# 启动 demo 开发服务器（端口 5173）
pnpm dev

# 构建包
pnpm build

# 执行全量测试
pnpm test:run
```

See [Engineering handoff](../engineering-handoff.md) for the complete command
reference.

## Optional WASM acceleration

FsusUI includes an optional WASM acceleration layer. These paths select it when
their runtime and adapter support it:

- **Table sorting:** Number and ASCII-string data can return stable row indices
  through Worker/WASM. Runtime history selects Worker/WASM or chunked JS; it
  does not switch on a fixed row-count threshold.
- **SelectV2 filtering:** A persistent index is rebuilt when options, labels, or
  filter mode changes. Queries use generation/cancellation and transferable
  index results; JS results remain available while WASM initializes.
- **VirtualList row-height estimation:** Lists with `>= 2000` items try the WASM
  batch estimator; smaller lists return to the caller's fallback estimate.
- **MarkdownRenderer:** The built-in renderer accepts Markdown and presents raw
  HTML as text. Its artifacts include `markdown_basic.js/.wasm` and
  `markdown_simd.js/.wasm`; the component does not include Markdown styling.

Rebuilding the WASM modules requires Emscripten `5.0.4`:

```bash
pnpm run build:wasm
pnpm run check:markdown-wasm
pnpm run check:markdown-wasm-runtime
```

See [Engineering handoff](../engineering-handoff.md#wasm) for the WASM workflow.

External consumers import the public wrapper `@ozwasyd/element-plus/wasm`.
The workspace package `@element-plus/wasm` and generated modules under
`es/wasm/*` or `lib/wasm/*` are internal build details.
