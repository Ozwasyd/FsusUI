# MarkdownRenderer Markdown 渲染器

基于 FsusBlog Markdown WASM 渲染器的无样式组件。

> 该组件不携带完整文章排版主题，但会在 DOM 提交后执行通用 feature activation：heading id、hash/external link 属性、CSP nonce、Mermaid/LaTeX 占位符和代码块高亮挂点都会由 FsusUI 统一归一。

---

## 基础用法

传入 `content` 后，组件会异步调用 `@element-plus/wasm` 中的 Markdown runtime。小文档保持 HTML fast path；大文档会按全局 Render Pipeline 预算切为 block chunks，只挂载当前 viewport 附近内容，避免长 Markdown 一次性把主线程 DOM/layout/paint 打满。

```vue
<template>
  <el-markdown-renderer :content="content" />
</template>
```

## Mermaid、KaTeX 与代码激活

WASM 渲染器会保留 Mermaid、LaTeX/KaTeX 相关的 HTML、MathML、SVG 或 placeholder 信息。组件提交 DOM 后会调用 public `markdown-runtime` 的 activation 层，默认懒加载 Mermaid、KaTeX 与 Shiki，真实渲染 `.markdown-renderer__mermaid`、`.markdown-renderer__latex` 和 `language-*` 代码块，同时修正 heading/hash/external link。业务侧可以监听 `features-activated` 获取稳定 activation 结果；仍可监听 `placeholders-ready` 读取占位符和完整渲染结果。

```vue
<template>
  <el-markdown-renderer
    :content="content"
    csp-nonce="request-csp-nonce"
    :features="{ latex: true, mermaid: true, codeHighlight: true }"
    @features-activated="onFeaturesActivated"
    @placeholders-ready="onPlaceholdersReady"
  />
</template>
```

默认 adapter 会按 `data-theme-resolved`、Element Plus token 和 `csp-nonce` 设置 Mermaid themeVariables、KaTeX 错误色、Shiki light/dark theme，以及动态 `<style>` 的 nonce。失败时不会让整个 renderer 崩溃，组件会输出 `el-markdown-renderer__feature-error` 节点并在 `features-activated.errors` 中报告错误。

`features` 用于关闭某类 activation；adapter prop 用于覆盖或禁用默认渲染器：

```vue
<template>
  <!-- 完全关闭 Mermaid activation，不扫描也不标记 -->
  <el-markdown-renderer :content="content" :features="{ mermaid: false }" />

  <!-- 保留 Mermaid 节点标记，但不使用默认 Mermaid renderer -->
  <el-markdown-renderer :content="content" :mermaid-adapter="null" />

  <!-- 用业务 adapter 覆盖默认 Mermaid renderer -->
  <el-markdown-renderer :content="content" :mermaid-adapter="renderMermaid" />
</template>
```

同样的语义适用于 `latex-adapter` 和 `code-highlight-adapter`。直接使用 public runtime 时，也可以从 `@ozwasyd/element-plus/markdown-runtime` 复用 `defaultMermaidAdapter`、`defaultLatexAdapter` 与 `defaultCodeHighlightAdapter`。

## Raw HTML 安全边界

`allow-html` 默认关闭。默认情况下，Markdown 源码中的 HTML 会被转义，避免把不可信内容直接注入页面。组件提交到 DOM 前还会默认执行一层 HTML sanitize，覆盖 `initial-html`、HTML fast path、完整结果和 chunked 结果。

只有在调用方确认内容可信时才应开启 `allow-html`。如业务已经在上游完成可信 HTML 过滤，并且需要保留完整 HTML 能力，可以显式设置 `:sanitize-html="false"` 关闭组件层 sanitize。

## Fsus 显式段落组

Fsus Markdown 保留原生 Markdown 的双换行段落规则，同时增加一个显式段落组语法，用于表达“这是一段连续讲解，但中间包含代码块、表格、列表或引用”等块级内容。

````md
::p
那么，在 Rust 中，`Err(E)` 的 `E` 是一个强类型枚举：

```rust
pub enum AppError {
  UserNotFound,
}
```

这句解释仍然属于同一个显式段落组。
::
````

规则：

- `::p` 必须独占一行，表示显式段落组开始。
- `::` 必须独占一行，表示当前显式段落组结束。
- 组内内容仍按普通 Markdown 解析，支持代码块、表格、列表、引用、Mermaid 与 LaTeX。
- 普通双换行段落不受影响；只有显式写出 `::p ... ::` 时才生成段落组。
- 该语法不是 raw HTML，`allow-html=false` 时仍然可用。
- DOM 不会输出非法的 `<p><pre>...</pre></p>`，而是输出合法结构：

```html
<section class="markdown-renderer__paragraph" data-fsus-paragraph>
  <p>...</p>
  <pre><code>...</code></pre>
  <p>...</p>
</section>
```

## 技术文本排版保护

Markdown 渲染器会为技术正文输出稳定 class，避免外层中文正文样式使用 `text-align: justify` 时，把夹杂 inline code 的窄列段落拉出异常字间距。

- 普通段落输出 `markdown-renderer__text`。
- 含 inline code 的段落额外输出 `markdown-renderer__text--inline-code`。
- 列表项输出 `markdown-renderer__list-item`，含 inline code 时额外输出 `markdown-renderer__list-item--inline-code`。
- 显式段落组输出 `markdown-renderer__paragraph` 与 `data-fsus-paragraph`。

组件内置极小的布局保护：显式段落组、列表项、含 inline code 的段落，以及窄容器内的正文会回退到自然起始对齐；普通段落、列表项、表格单元和链接允许安全断行，避免 escaped raw HTML 探针或超长 URL 撑开页面；代码块仍保留横向滚动语义。这不会改变 Markdown 解析语义。

## 嵌入块尺寸保护

渲染器输出的 Mermaid SVG 会带有 `width`、`height`、`preserveAspectRatio` 以及 `data-mermaid-width` / `data-mermaid-height`，组件会按 SVG 的自然尺寸展示，不会默认铺满整行。图表默认限制在 `--fsus-markdown-diagram-max-width`（默认 `32rem`）以内，LaTeX 块的最大宽度受阅读器容器约束；极宽内容在嵌入块内部滚动，避免撑开页面或把简单图表放大成整屏图。

## WASM API

底层 API 从 `@element-plus/wasm` 导出：

```ts
import {
  initMarkdownRuntime,
  renderMarkdownChunksWithRuntime,
  renderMarkdownHtmlWithRuntime,
  renderMarkdownSummaryWithRuntime,
  renderMarkdownWithRuntime,
  renderMarkdownResultWithRuntime,
} from '@element-plus/wasm'
```

这些异步 API 都返回 `Promise<FsusResult<T>>`。`ok: false` 时的 `error` 是 `FsusErrorDetail`，不会用 `null` 表示 runtime unavailable。

`renderMarkdownHtmlWithRuntime` 的 `value` 只包含 HTML 与 timings；`renderMarkdownSummaryWithRuntime` 返回 HTML、features 和 metadata counts；`renderMarkdownResultWithRuntime` 返回 `html`、`features`、`placeholders`、`metadata`、timings 和当前 engine 信息；`renderMarkdownChunksWithRuntime` 额外返回 block 级 `chunks`，供 Render Pipeline 做虚拟挂载；`renderMarkdownWithRuntime` 只返回 HTML 字符串。

chunk 边界由 WASM 渲染流程产出，类型包括 `heading`、`paragraph`、`list`、`table`、`code`、`blockquote`、`latex`、`mermaid`、`footnotes`、`rule`、`html`。组件不会在 Vue 层用正则切最终 HTML。

## 长文档虚拟挂载

`ElMarkdownRenderer` 会读取最近的可滚动祖先作为 viewport，没有可滚动祖先时使用页面 viewport。分块渲染时 DOM 结构保持稳定：

- 根节点带 `data-fsus-render-strategy="chunked-worker"`、`chunked-main` 或 `sync`。
- 可见 chunk 带 `data-fsus-render-unit`、chunk key、kind 和 HTML offset。
- 上下 spacer 保持总高度，ResizeObserver 按帧批处理测量结果。
- 上方 chunk 高度变化时按锚点补偿 scrollTop，避免滚动中跳回前文。

阈值与预算通过 `ElConfigProvider` 的 `render-pipeline` 配置统一控制；MarkdownRenderer 不新增专属开关。

大文档优先走 Render Pipeline adapter 的托管 Worker。Worker 只负责 Markdown 分块与 metadata 预计算，主线程仍负责虚拟挂载、测量和锚点保持；Worker 超时、崩溃、Abort 或不可用时会自动降级到 `chunked-main`，组件不会持有自己的私有 worker executor。

---

## API

### Attributes

| 属性名                 | 说明                                                                                     | 类型                                            | 默认值    |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- | --------- |
| content                | Markdown 源文本                                                                          | `string`                                        | `''`      |
| initial-html           | 初始 HTML，用于首帧占位                                                                  | `string`                                        | `''`      |
| allow-html             | 是否允许 Markdown 源码中的 raw HTML                                                      | `boolean`                                       | `false`   |
| sanitize-html          | DOM 提交前是否清理不安全 HTML                                                            | `boolean`                                       | `true`    |
| allow-latex            | 是否启用 LaTeX/MathML 输出                                                               | `boolean`                                       | `true`    |
| allow-mermaid          | 是否启用 Mermaid 输出                                                                    | `boolean`                                       | `true`    |
| mode                   | 渲染模式元数据                                                                           | `'article' \| 'about' \| 'preview' \| 'editor'` | `article` |
| base-url               | 渲染元数据与 link activation 的基础 URL                                                  | `string \| null`                                | `null`    |
| csp-nonce              | 写入 renderer 内动态 style 的 CSP nonce                                                  | `string \| null`                                | `null`    |
| features               | DOM feature activation 开关                                                              | `MarkdownFeatureActivationFeatureOptions`       | —         |
| mermaid-adapter        | Mermaid DOM activation adapter；`undefined` 使用默认 adapter，`null` 只标记不渲染        | `MarkdownFeatureAdapter \| null`                | —         |
| latex-adapter          | LaTeX/KaTeX DOM activation adapter；`undefined` 使用默认 adapter，`null` 只标记不渲染    | `MarkdownFeatureAdapter \| null`                | —         |
| code-highlight-adapter | 代码高亮 DOM activation adapter；`undefined` 使用默认 Shiki adapter，`null` 只标记不渲染 | `MarkdownFeatureAdapter \| null`                | —         |

### Events

| 事件名             | 说明                                                              |
| ------------------ | ----------------------------------------------------------------- |
| render-complete    | 渲染完成，参数为完整 `MarkdownRenderResult`                       |
| render-error       | WASM runtime 渲染失败，参数为 `FsusErrorDetail`                   |
| features-activated | DOM feature activation 完成，参数为 activation 结果与完整渲染结果 |
| placeholders-ready | 占位符可用，参数为 `placeholders` 与完整渲染结果                  |
| render-profile     | 渲染阶段耗时可用，参数为 `MarkdownRuntimeProfile`                 |

### Exposes

| 名称   | 说明         |
| ------ | ------------ |
| rootEl | 渲染容器元素 |
