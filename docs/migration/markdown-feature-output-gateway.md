# Markdown feature 输出网关迁移

`ElMarkdownRenderer` 不再接受 `mermaidAdapter`、`latexAdapter` 或
`codeHighlightAdapter`。`MarkdownFeatureAdapter` 和三个默认 adapter export
也已删除。这是一次性 breaking change，不提供 deprecated、legacy 或版本分支。

## 调用方迁移

删除所有接收 `HTMLElement` 并修改 feature DOM 的 callback：

```vue
<!-- before -->
<el-markdown-renderer :content="content" :mermaid-adapter="renderMermaid" />

<!-- after -->
<el-markdown-renderer
  :content="content"
  :features="{ mermaid: true, latex: true, codeHighlight: true }"
/>
```

需要禁用某类内建 feature 时，只使用 `features`：

```vue
<el-markdown-renderer :content="content" :features="{ mermaid: false }" />
```

不要把旧 callback 改写成 `ShadowRoot`、`DocumentFragment` 或另一个 DOM
容器。调用方不再拥有第三方 feature HTML 的提交入口。

## 输出与主题边界

内建 Mermaid、KaTeX 和 Shiki renderer 只接收不可变 source、theme 与受控
token，返回 discriminated `FeatureRenderOutput`。唯一的 FsusUI-owned gateway
按 `kind` 分派到三套独立、checked-in policy 后提交 DOM：

- code highlight 只允许 Shiki 所需的 `pre`、`code`、`span` 结构和明确 style；
- LaTeX 使用 KaTeX 的 MathML 输出，只允许声明的 HTML wrapper、MathML
  标签与属性；
- Mermaid 只允许声明过的 SVG 标签、属性、本地 fragment 引用和 SVG namespace。

调用方不能传入 HTML、CSS text 或 DOM callback 定制主题。主题继续来自
`data-theme-resolved` 与 Element Plus 的 `--el-*` typed token；CSP nonce 仍由
`csp-nonce` 提供。颜色 token 在传给 Mermaid / KaTeX 之前按受控颜色语法
验证；Mermaid 固定 `htmlLabels: false`，不把 `foreignObject` 作为标签渲染
路径。

所有 policy 都会移除脚本、事件属性、`srcdoc`、`foreignObject`、可执行 URL、
外部资源、未知 namespace、未知标签和未声明属性。feature 失败节点只通过
`textContent` 写入错误与原 source，不会把 source 交给 HTML parser。

## Package subpath 迁移

本次 major change 同时移除包级的宽泛 deep export。WASM generated/runtime
internals（包括 `es/wasm/*`、`lib/wasm/*` 和 Markdown feature output gateway）
不再能由包外调用方导入；它们仍作为物理构建产物供包内相对 import 使用。

- Markdown 调用方使用 `@ozwasyd/element-plus/markdown-runtime`；
- WASM 调用方使用 `@ozwasyd/element-plus/wasm`；
- Vue 组件优先使用根 package；确有兼容需要时只使用已保留的
  `es|lib/components/*`；
- locale 与主题资产分别使用 `es|lib/locale/*` 和 `theme-chalk/*`。

其他未列出的 top-level 或 deep subpath 不再由 package exports 暴露。不要把
被移除的 broad deep import 改写为编码路径或直接寻找构建目录文件。

## Release 构建性能复核

`markdown-feature-activation` 是独立的真实渲染场景，不改变既有
`markdown-cold` / `markdown-hot`。它在初始 ready 和每次 `act()` 时等待
Mermaid、KaTeX、Shiki 三类内建 activation 全部完成；每个 sample 都更新
`content-version` 并产生新的 source，runner 会拒绝重复读取初始
`activationMs`。

在 base 与 current worktree 中分别构建同一 Release 形态，并从固定端口提供
该构建：

```bash
pnpm run build:demo
pnpm -C vue/packages/demo-app exec vite preview --host 127.0.0.1 --port 5188 --strictPort
```

`build:demo` 是 Release demo 的完整 owner：它先通过 `ensure:wasm` 物化当前
worktree 源码绑定的 Wasm 产物，再构建 demo。base 与 current 必须各自执行该
命令；不得复制、共享或链接 candidate/current 的 Wasm 产物给 base。

随后顺序运行（base 先于 current）：

```bash
node scripts/web-render-performance.mjs --no-server --port 5188 --scenario markdown-feature-activation --warmups 1 --samples 5 --output .tmp/performance/markdown-feature-activation
```

current 可通过 `--baseline <base-summary.json>` 读取同 runner 的 base summary。
该专用场景会同时检查 activation p50 与 p95，任一相对 base 回退超过 5%
即失败。runner 还会记录 5 次 activation 的真实 DOM parser 入口操作数：
5 个样本必须均为正数且保持稳定，current 的最大值不得高于 baseline 的最大值。
命令只消费本地构建，不发布包。
