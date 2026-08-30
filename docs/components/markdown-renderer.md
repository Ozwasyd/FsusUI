# MarkdownRenderer Markdown 渲染器

基于 FsusBlog Markdown WASM 渲染器的无样式组件。

> 该组件不携带完整文章排版主题，但会在 DOM 提交后执行通用 feature activation：heading id、hash/external link 属性、CSP nonce、Mermaid/LaTeX 占位符和代码块高亮挂点都会由 FsusUI 统一归一。

## Public Preview Notes

| 字段                   | 说明                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| purpose                | 将 Markdown 内容渲染为可激活的安全文章 DOM，并为长文档提供分块和虚拟挂载能力。                                                                   |
| basic usage            | 传入 `content`，按需配置 `features` 与 Render Pipeline 预算。                                                                                    |
| props / events / slots | 本页 `API` 覆盖公开 props、events 和 exposes；runtime 深层实现不属于组件 API。                                                                   |
| accessibility          | 业务侧需要为文章容器提供标题层级和阅读上下文；Mermaid、LaTeX、代码块等增强内容应保留文本回退或错误提示。                                         |
| theme token notes      | 组件默认无完整文章主题；可使用公开文本、背景、主色、代码块和 motion token 绑定业务排版。                                                         |
| known limitations      | Markdown runtime、WASM、feature activation 和 chunked rendering 在 public preview 期间均为 experimental；Markdown 源码中的 HTML 永远按文本呈现。 |
| stability level        | Experimental component。                                                                                                                         |

---

## 基础用法

传入 `content` 后，组件会异步调用 `@element-plus/wasm` 中的 Markdown runtime。每个 generation 只执行一次完整解析，不再先走 HTML-only、随后对同一内容重复完整解析。大文档会按全局 Render Pipeline 预算切为 block chunks，先提交首个可读 section，再按 frame budget 补齐其余描述符，并只挂载当前 viewport 附近内容，避免长 Markdown 一次性把主线程 DOM/layout/paint 打满。

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

内建 renderer 会按 `data-theme-resolved`、Element Plus token 和 `csp-nonce` 设置 Mermaid themeVariables、KaTeX 错误色、Shiki light/dark theme，以及允许的动态 `<style>` nonce。Mermaid、KaTeX 与 Shiki 只在对应 chunk 接近 viewport 时激活；安全 gateway 与对应第三方 renderer 并行按需加载，三类 activation 共享同一个 gateway 单例加载结果；Shiki 只加载实际遇到的 grammar 和当前 theme。多个 renderer 的 activation 使用有界并发，不共享一把全局 Promise 锁。失败时不会让整个 renderer 崩溃，组件会用 `textContent` 构造 `el-markdown-renderer__feature-error` 节点，并在 `features-activated.errors` 中报告错误。

`features` 用于关闭某类 activation：

```vue
<template>
  <!-- 完全关闭 Mermaid activation，不扫描也不标记 -->
  <el-markdown-renderer :content="content" :features="{ mermaid: false }" />
</template>
```

feature renderer 不再接受调用方 DOM adapter。内建 Mermaid、KaTeX、Shiki 只读取不可变 source、theme 和受控 token，返回带 `kind` 的 `FeatureRenderOutput`；输出统一经过 FsusUI-owned gateway 的独立 Mermaid SVG、KaTeX MathML、Shiki HTML policy 后才提交。Mermaid 强制使用原生 SVG text 而不是 `foreignObject`，进入第三方 renderer 前的颜色 token 也会按受控颜色语法验证。三类 policy 不共享标签或属性并集，未知标签、namespace、属性、事件、可执行 URL 与外部资源都会被移除。迁移方法见[收敛 Markdown feature 输出网关](../migration/markdown-feature-output-gateway.md)。

### Test-only XSS differential corpus

`spec/security/markdown-xss-corpus.json` 是 Markdown 安全测试的唯一 case
事实源；schema 与消费者 manifest 位于同一目录。FsusBlog 等消费者只能从
FsusUI 单向读取或使用
`node scripts/export-markdown-xss-corpus.mjs --out <test-fixture-directory>`
复制这三份 test-only 文件，不能在 production runtime import corpus，也不能让
FsusUI 反向依赖消费者。manifest 的 SHA-256 与静态门禁确保副本可检测漂移。

`pnpm run check:markdown-xss` 固定使用 `xorshift32-v1`、seed `2662026`
执行至少 2,000 次 mutation；release lane
`pnpm run check:markdown-xss:release` 执行至少 20,000 次。可用
`FSUS_MARKDOWN_XSS_SEED=<reported-seed>` 和
`FSUS_MARKDOWN_XSS_FUZZ_ITERATIONS=<count>` 复现；失败会同时输出 case ID、
surface、seed 和最小输入。两个门禁都让 Chromium、Firefox、WebKit 解析最终
DOM，并覆盖 sync、Wasm、Worker、chunked、SSR/no-DOM、`initialRender`
hydration 与 Mermaid/KaTeX/Shiki gateway。corpus、manifest 和六个 kill
control 没有 package export，静态 gate 还会扫描 production source、ESM/CJS、
browser chunk 与 Wasm artifact，阻止 test-only marker 进入发布产物。

## Raw HTML 安全边界

Markdown 协议不接受原始 HTML。核心渲染器会在 sync、Worker、chunked 和 html-only 路径中统一转义 HTML 块与行内标签，并在生成链接与图片属性时拒绝危险协议、协议相对 URL、控制字符、反斜杠混淆和 data URL。所有可提交 HTML 都封装在不透明的 `MarkdownSafeHtml` / `MarkdownSafeRenderResult` 中；普通 `string` 不能赋给这些类型，组件也不提供二次清洗开关或字符串构造入口。

SSR 或可信缓存首显应把 runtime 返回的完整结果传给 `initial-render`。组件只复用持有 runtime authority，且 renderer version、规范化源文和 `sourceIdentity` 都与当前请求一致的结果；任一条件不匹配都会丢弃首显结果并重新渲染。

启用 `require-trusted-types-for 'script'` 的宿主应传入 `trusted-html-factory` 与 `trusted-script-url-factory`。HTML factory 只接收 `MarkdownSafeHtml`，不负责清洗；worker factory 只接收构建生成的 Markdown worker `URL`。内建 Mermaid、KaTeX、Shiki 的唯一 feature gateway 还会按需创建不公开、非 default 的 `fsusui-markdown-feature` policy，仅用于 inert `<template>` 解析；解析后的 DOM 仍必须通过对应 feature 的独立 sanitizer 与 root validation 才能提交。若宿主通过 CSP `trusted-types` 限制 policy 名称，必须显式允许 `fsusui-markdown-feature`；policy 创建被拒绝时 feature 提交 fail closed，目标 DOM 不会部分更新。真实 Chromium 生产 CSP 证据由 `pnpm run check:markdown-feature-trusted-types` 固定。

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
- 该语法不是原始 HTML，始终可用。
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

chunk 边界由 WASM 渲染流程产出，类型包括 `heading`、`paragraph`、`list`、`table`、`code`、`blockquote`、`latex`、`mermaid`、`footnotes`、`rule`、`generated`。`generated` 仅表示无法归入其他类别的渲染器生成块，不表示原始 HTML 输入能力。组件不会在 Vue 层用正则切最终 HTML。

## 长文档虚拟挂载

`ElMarkdownRenderer` 会读取最近的可滚动祖先作为 viewport，没有可滚动祖先时使用页面 viewport。分块渲染时 DOM 结构保持稳定：

- 根节点带 `data-fsus-render-strategy="chunked-worker"`、`chunked-main` 或 `sync`。
- 可见 chunk 带 `data-fsus-render-unit`、chunk key、kind 和 HTML offset。
- 上下 spacer 由增量高度索引计算：单个 chunk 测量更新、offset/index 查询均为 O(log N)，total size 查询为 O(1)，可见窗口变化不会重建全量 metadata 数组。
- 每个 renderer 的 virtual window 只创建一个共享 `ResizeObserver`；element 关联使用弱引用，测量结果按帧和 `measureBatch` 批量提交，历史高度缓存有明确上限。
- 同批次中只累计锚点之前的高度差，并最多补偿一次 `scrollTop`；连续插入、删除或重排时优先按稳定 chunk key 恢复锚点，避免跳回前文。
- SSR 或无 `ResizeObserver` 环境不创建观察器，首次挂载仍以确定性的 `offsetHeight` 回填估算值。
- Mermaid、KaTeX 与 Shiki activation 由带预加载边界的 `IntersectionObserver` 驱动；不支持该 API 时保持兼容，立即激活当前已挂载 chunk。
- 新 `content` generation 会同时取消解析、结果传输、分帧提交、activation 与过期 cache write；Worker 解析中的同步 WASM 任务会通过终止其 parser worker 实际停止，而不是只丢弃最终结果。
- Worker 内部 cache 每个 fingerprint 只保留由本次 WASM runtime 生成的一份 canonical payload；主线程组件不暴露可写 cache 或 setter，也不会接受 caller 注入的缓存结果。

阈值与预算通过 `ElConfigProvider` 的 `render-pipeline` 配置统一控制；MarkdownRenderer 不新增专属开关。

大文档优先走 Render Pipeline adapter 的 shared Worker pool。每个 pool slot 使用轻量 broker worker 管理可终止的 parser worker；Worker 负责 Markdown 分块、metadata 预计算和增量完整 fingerprint，主线程仍负责虚拟挂载、测量和锚点保持。每个 renderer 使用独立 key/generation，连续编辑会向 Worker 发送 cancel，并终止正在执行同步 WASM 的 parser worker，旧 generation 不得继续传输、提交或写缓存。单 Worker 超时或崩溃只影响对应 slot，其他 renderer 任务继续运行；Worker 不可用时会等待主线程 idle/frame 预算后降级到 `chunked-main`，组件不会持有自己的私有 executor。

---

## API

### Attributes

| 属性名                     | 说明                                                                                    | 类型                                            | 默认值    |
| -------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- | --------- |
| content                    | Markdown 源文本                                                                         | `string`                                        | `''`      |
| content-version            | 可选稳定内容版本；大文档提供后可跳过主线程完整哈希，并参与 generation/cache fingerprint | `string \| number \| null`                      | `null`    |
| initial-render             | 同源同版本且持有 runtime authority 的安全结果，用于 SSR 或可信缓存首显                  | `MarkdownSafeRenderResult \| null`              | `null`    |
| trusted-html-factory       | 将安全 HTML 转为宿主 policy 的 `TrustedHTML`；不承担清洗职责                            | `(html: MarkdownSafeHtml) => object`            | —         |
| trusted-script-url-factory | 将 Markdown worker URL 转为宿主 policy 的 `TrustedScriptURL`                            | `(url: URL) => unknown`                         | —         |
| allow-latex                | 是否启用 LaTeX/MathML 输出                                                              | `boolean`                                       | `true`    |
| allow-mermaid              | 是否启用 Mermaid 输出                                                                   | `boolean`                                       | `true`    |
| mode                       | 渲染模式元数据                                                                          | `'article' \| 'about' \| 'preview' \| 'editor'` | `article` |
| base-url                   | 渲染元数据与 link activation 的基础 URL                                                 | `string \| null`                                | `null`    |
| csp-nonce                  | 写入 renderer 内动态 style 的 CSP nonce                                                 | `string \| null`                                | `null`    |
| features                   | 内建 feature activation 开关                                                            | `MarkdownFeatureActivationFeatureOptions`       | —         |

### Events

| 事件名             | 说明                                                              |
| ------------------ | ----------------------------------------------------------------- |
| render-complete    | 渲染完成，参数为完整 `MarkdownSafeRenderResult`                   |
| render-error       | WASM runtime 渲染失败，参数为 `FsusErrorDetail`                   |
| features-activated | DOM feature activation 完成，参数为 activation 结果与完整渲染结果 |
| placeholders-ready | 占位符可用，参数为 `placeholders` 与完整渲染结果                  |
| render-profile     | 渲染阶段耗时可用，参数为 `MarkdownRuntimeProfile`                 |

### Exposes

| 名称   | 说明         |
| ------ | ------------ |
| rootEl | 渲染容器元素 |
