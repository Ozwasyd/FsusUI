# FsusUI Design System: The Intellectual Minimalist

> **Version:** 0.1 · **Status:** Stable · **Scope:** FsusUI component library defaults, documentation examples, and product integration · **Last updated:** 2026-06-15
>
> 维护者：FsusUI core team。关联文档：[`docs/theme/tokens.md`](../theme/tokens.md)、[`docs/theme/motion.md`](../theme/motion.md)、[`docs/element-plus-integration.md`](../element-plus-integration.md)、[`docs/api-stability.md`](../api-stability.md)。术语约定见 [§13 Terminology](#13-terminology)。

## 1. Scope and Intent

FsusUI 2026 的设计语言定义为 **The Intellectual Minimalist（高智感极简主义）**。它不是一组装饰风格，而是一套用于组件库实现、文档示例和产品集成的设计约束。

核心目标：

- 用清晰的排版、稳定的栅格和克制的颜色建立专业感。
- 保留 Element Plus 的可迁移性，同时形成 FsusUI 自己的视觉识别。
- 让组件在管理后台、内容编辑、知识产品和工具型界面中保持长期可读、可维护、可扩展。

这套语言由三类原则组成：

1. **Swiss Graphic Design**: 使用左对齐、明确网格、充分留白和清晰的信息层级。
2. **Ivy / Editorial Restraint**: 借鉴学术出版物的克制和低调质感，优先表达内容与结构。
3. **Firm Yet Soft**: 结构精确，控件边缘和交互反馈柔和。微圆角、细描边和低强度阴影降低机械感，但不削弱界面秩序。

## 2. Brand Motif: Punctuation

FsusUI 从 `Fsu's Blog.` 的句点中提取 **Punctuation Mark（标点）** 作为品牌识别元素。

使用规则：

- 句点可用于列表符号、标题锚点、加载状态或空状态中的微型视觉记号。
- 句点服务于信息结构，不作为大面积装饰图形使用。
- 句点颜色默认使用 `--fsus-dot-gray` / `--el-color-info`，避免使用强调色抢占交互语义。
- 同一视图不重复使用过多句点装饰。页面级标题、列表和加载状态三者同时出现时，只保留信息最明确的一处。

## 3. Typography

排版是 FsusUI 的主要视觉载体。字体、字号、行高和对齐方式优先解决可读性与信息层级。

### Typeface

- Latin and numbers: `Google Sans`
- CJK: `Noto Sans CJK` / `Noto Sans SC`
- Fallback: `PingFang SC`, `Microsoft YaHei`, `Helvetica Neue`, `Arial`, `sans-serif`

### Layout Rules

- 正文和主要信息默认左对齐，使用 ragged right，不做两端对齐。
- 大段文本禁止居中。居中只用于结构明确的小组件，例如空状态、结果页或确认弹窗的标题区。
- 层级通过字号、字重、行高和留白建立，不通过颜色堆叠建立。
- 默认正文为 `14px`，小型说明为 `12px` 或 `13px`，标题按组件语境使用 `16px`、`18px`、`20px` 或页面级更大字号。
- 不使用负字距。大标题也应保持自然字距。

### Rationale

排版规则对齐 [`docs/theme/tokens.md`](../theme/tokens.md) 中标记为 public 的 typography token（`--el-font-size-*` 与未来 `--fsus-font-size-*`）。字体栈包含 `Noto Sans CJK` 与 `PingFang SC`，保证 CJK 文本与西文文本在 `14px` 基线下基线对齐；正文左对齐（`text-align: left`）是因为管理后台、Markdown 编辑器、表格列宽都依赖稳定的左基线，两端对齐在窄列里会产生不规则的字间距。默认正文 `14px` 来自 Element Plus 默认值；不引入更小的基线是因为 Chromium / Firefox 的最低可读字号实验数据集中在 `13–14px`。

## 4. Color and Surface

FsusUI 的色彩系统围绕 **Ink / Paper / Dot / Scholarly Blue** 展开。颜色承担明确职责：文本、背景、结构、交互反馈四个角色互不重叠。

### Core Palette

| Concept        | Light                 | Dark      | Runtime Token                           | Usage                                     |
| -------------- | --------------------- | --------- | --------------------------------------- | ----------------------------------------- |
| Ink            | `#0F0F11`             | `#F0F0F4` | `--fsus-ink`, `--el-text-color-primary` | 主要文本、品牌字标、Primary Button 默认色 |
| Paper          | `#FFFFFF` / `#FCFCFC` | `#121214` | `--fsus-paper`, `--el-bg-color`         | 控件和浮层表面                            |
| Page           | `#F7F7F8`             | `#09090B` | `--fsus-page`, `--el-bg-color-page`     | 页面背景                                  |
| Dot Gray       | `#A1A1AA` / `#8E8E93` | `#71717A` | `--fsus-dot-gray`, `--el-color-info`    | 次级文本、弱边框、禁用态                  |
| Border         | `#E4E4E7`             | `#27272A` | `--fsus-border`, `--el-border-color`    | 默认边框和分隔线                          |
| Scholarly Blue | `#2A599C`             | `#4B79CC` | `--fsus-scholarly-blue`                 | 链接、激活态、Focus Ring、交互 Hover      |

### Accent Rules

- `Scholarly Blue` 只用于功能性反馈：链接、选中、焦点、键盘导航、少量 Hover 状态。
- 不用蓝色做大面积背景、渐变、氛围光或品牌装饰。
- 成功、警告、危险色只在语义场景中出现，例如表单错误、删除确认、状态标签。
- 同一组件内同时出现主按钮、链接和选中态时，蓝色优先给焦点或选中态，避免所有元素一起高亮。

### Rationale

`Scholarly Blue` 选用 `#2A599C` 而非 Element Plus 默认 `#409EFF`，因为后者在长时间阅读的表格、Markdown 编辑器、邮件会话视图里饱和度过高，会与正文抢焦点。暗色下提亮到 `#4B79CC` 是为了在 `--fsus-page: #09090B` 背景上保证 ≥ 4.5:1 的对比度（WCAG AA 正文标准）。`Ink / Paper / Dot / Scholarly Blue` 四个角色互不重叠，确保任何一个组件的视觉差异都能被映射到一个语义角色，而不是临时拼色。

## 5. Space, Radius, and Density

界面结构以 4px 间距阶梯为基础，使用明确的控件高度和面板半径。组件库文档、设计稿和实现优先引用 token，不手写一次性数值。

### Spacing

| Token            | Value  | Usage                               |
| ---------------- | ------ | ----------------------------------- |
| `--fsus-space-1` | `4px`  | 图标与文本的紧凑间距                |
| `--fsus-space-2` | `8px`  | 控件内部小间距                      |
| `--fsus-space-3` | `12px` | 表单项、列表项紧凑间距              |
| `--fsus-space-4` | `16px` | 默认组间距                          |
| `--fsus-space-5` | `20px` | 面板内部中等间距                    |
| `--fsus-space-6` | `24px` | Dialog、Card、Drawer 的主要 padding |
| `--fsus-space-8` | `32px` | 页面区块和移动端浮层安全间距        |

### Radius

| Surface          | Value   | Token                                              | Usage                                |
| ---------------- | ------- | -------------------------------------------------- | ------------------------------------ |
| Small control    | `4px`   | `--fsus-radius-control-small`                      | 小尺寸按钮、紧凑输入、标签内部结构   |
| Control          | `6px`   | `--fsus-radius-control`, `--el-border-radius-base` | Button、Input、Select、Checkbox 外框 |
| Popover          | `10px`  | `--fsus-radius-popover`                            | Tooltip、Popover、Dropdown 内层面板  |
| Panel            | `12px`  | `--fsus-radius-panel`, `--el-dialog-border-radius` | Dialog、Drawer、Card、MessageBox     |
| Expressive panel | `24px`  | `--fsus-radius-panel-large`                        | 仅限 opt-in expressive surface       |
| Pill             | `999px` | `--fsus-radius-pill`, `--el-border-radius-round`   | Badge、圆形图标按钮、胶囊标签        |

### Density

- 默认控件高度：`44px`
- 大号控件高度：`48px`
- 紧凑控件高度：`40px`
- 图标按钮触控目标：`40px`
- 表格默认行内 padding：`12px 0`
- 表格紧凑行内 padding：`10px 0`
- 表格大尺寸行内 padding：`14px 0`

密度只用于表达任务场景，不表达视觉偏好。数据管理、日志、表格操作使用紧凑密度；表单录入和配置页使用默认密度；营销式展示页不应反向污染组件库默认密度。

### Rationale

4px 间距阶梯源自 Material Design 4dp 与 Apple HIG 4pt 最小可点击单位的公约，能让栅格、控件、图标三方的像素值都对齐到同一基准。控件高度采用 `40 / 44 / 48px` 三档：`44px` 对齐 Apple HIG 最小触控目标（44pt），`40px` 对齐 Element Plus 紧凑场景，`48px` 给大号 CTA 与表单主操作留出 ≥ `12px` 垂直呼吸。表格行内 padding `10 / 12 / 14px` 形成 1.2× 缩放比，让用户在切换密度时能视觉感知而不需要看设置。

## 6. Depth and Material

FsusUI 默认使用 paper/document material、细边框和稳定留白表达层级。玻璃、强阴影和装饰性动效是 opt-in，不作为普通组件默认值。

### Overlay Material

- 浮层背景使用 `--fsus-surface-overlay`，默认约 `rgba(255, 255, 255, 0.98)`。
- 默认不使用背景模糊：`--fsus-backdrop-blur`、`--fsus-backdrop-blur-soft` 和 `--fsus-backdrop-blur-overlay` 均为 `0px`。
- 毛玻璃是 opt-in material，仅通过 `.is-glass` 或 `[data-fsus-material='glass']` 用于有明确悬浮层语义的场景。
- 阅读表面（`[data-fsus-surface='reading']`）必须保持 paper/document feel，不使用 blur、glow 或 motion trail。

### Shadow

| Token                         | Value                                | Usage                          |
| ----------------------------- | ------------------------------------ | ------------------------------ |
| `--fsus-shadow-panel`         | `none`                               | 普通 Dialog、Card、Drawer 面板 |
| `--fsus-shadow-panel-light`   | `0 8px 24px rgba(15, 23, 42, 0.05)`  | Opt-in 低层级浮层              |
| `--fsus-shadow-panel-lighter` | `0 2px 8px rgba(15, 23, 42, 0.04)`   | Opt-in 轻微浮起元素            |
| `--fsus-shadow-floating`      | `0 12px 32px rgba(15, 23, 42, 0.08)` | Notification、临时悬浮提示     |

避免使用重黑投影、彩色光晕和无层级意义的外发光。

## 7. Motion

动效用于解释状态变化，不用于制造视觉存在感。控件反馈不超过 `220ms`，浮层不超过 `360ms`。

| Token                        | Value                          | Usage                                 |
| ---------------------------- | ------------------------------ | ------------------------------------- |
| `--fsus-motion-control-fast` | `140ms`                        | Checkbox、Radio、Switch 的即时反馈    |
| `--fsus-motion-control`      | `220ms`                        | Button、Input、Tag、Tab 等控件状态    |
| `--fsus-motion-overlay`      | `300ms`                        | 遮罩淡入淡出                          |
| `--fsus-motion-panel`        | `360ms`                        | Dialog、Drawer、Dropdown 的进入与离开 |
| `--fsus-motion-standard`     | `cubic-bezier(0.4, 0, 0.2, 1)` | 默认缓动                              |
| `--fsus-motion-emphasized`   | `cubic-bezier(0.2, 0, 0, 1)`   | 浮层进入、重点内容揭示                |

规则：

- 控件 Hover 位移不超过 `translateY(-1px)`。
- 面板进入位移在 `8px` 到 `20px` 之间。
- 禁止弹跳、过冲和循环装饰动画。
- 必须支持 `prefers-reduced-motion: reduce`，将非必要动画降至 `1ms` 或移除 transform。

### Rationale

动效时长 `140 / 220 / 300 / 360ms` 对应 Material Design 推荐的「fast / normal / slow / extra-slow」分级。控件反馈上限 `220ms` 来自人因工程：交互反馈感知阈值约 `100ms`，超过 `250ms` 会被识别为「延迟」而非「反馈」，因此把控件状态切换统一压在 `220ms` 以内。浮层 `360ms` 给进入位移 `8–20px` 留出减速距离，避免视觉跳变。`prefers-reduced-motion` 降级到 `1ms`（而非 `0ms`）是为了让 Vue 的 `<transition>` 钩子仍然触发，防止某些组件的「消失/出现」状态机在 SSR + reduce-motion 用户上卡死。

## 8. Component Implementation Rules

### Button

- 默认高度 `44px`，大号 `48px`，小号 `40px`。
- 默认水平 padding `16px`，大号 `20px`，小号 `12px`。
- 图标与文字间距：默认 `6px`，大号 `8px`，小号 `4px`。
- Primary 默认使用 Ink Black，白色文字，无额外描边。
- Primary Hover 使用 `Scholarly Blue`（见 [§4 Accent Rules](#4-color-and-surface)），允许 `translateY(-1px)` 和 `--el-box-shadow-light`。
- Secondary / Ghost 使用透明或 Paper 背景、`1px` 边框和 Ink 文本。
- Focus Visible 使用 `2px` inset focus ring：`var(--fsus-scholarly-blue)`。
- Loading 态遮罩继承按钮圆角，不改变按钮宽高。

### Form Controls

- Input、Select、Textarea 默认圆角 `6px`（见 [§5 Radius](#5-space-radius-and-density)），边框 `1px solid var(--el-border-color)`（见 [§4 Border](#4-color-and-surface)）。
- Input 默认高度 `44px`，大号 `48px`，小号 `40px`（见 [§5 Density](#5-space-radius-and-density)）。
- Input 水平 padding 默认 `12px`，大号 `16px`，小号 `8px`。
- Focus Visible 使用 `2px` inset blue ring，禁用浏览器默认 outline。
- Invalid 状态优先显示语义色和错误文案，不使用动画或外发光吸引注意。
- Disabled 状态使用 `--el-disabled-bg-color`、`--el-disabled-text-color`、`--el-disabled-border-color`，透明度不能低到影响可读性。

### Dropdown, Select, Popover

- Dropdown 面板默认 padding `8px 0`（见 [§5 Spacing](#5-space-radius-and-density)），最大高度 `274px`。
- Popover 半径使用 `10px`；Select Dropdown 可使用 `12px` 以匹配浮层语言。
- 阴影默认 `none`，仅在需要明确层级时 opt into `--el-box-shadow-light`，不叠加额外外发光。
- 选中项用 `Scholarly Blue` 或浅蓝背景表达，不使用高饱和整行色块。
- 列表项需要稳定高度，Hover、Active、Disabled 三种状态必须可区分。

### Dialog and Drawer

- Dialog 默认宽度 `50%`，默认顶部间距 `15vh`。
- 面板圆角 `12px`，主 padding `24px`（均见 [§5](#5-space-radius-and-density)）。
- Header、Body、Footer 共享同一左右内边距，关闭按钮与标题基线保持明确关系。
- 关闭按钮触控区域 `54px`，Focus Visible 使用圆形 `2px` ring。
- Overlay 使用半透明 Paper，backdrop blur 默认 `0px`，不变成沉重黑色遮罩。
- Drawer 与 Dialog 使用同一层级语言：paper material、`12px` 面板圆角、边框优先。

### Table

- 表格优先服务扫描、比较和重复操作，不做卡片化单元格。
- 默认字号 `14px`，小尺寸 `12px`。
- 单元格水平 padding：默认 `16px`，大号 `18px`，小号 `12px`。
- 行 Hover 使用 `--el-fill-color-light`，当前行使用低饱和选中背景。
- 固定列阴影只表达遮挡关系，不作为装饰。
- 操作列中的按钮使用 inline action 风格，避免在密集表格中出现抬升、缩放或大阴影。

### Tabs and Navigation

- Tabs header 默认高度 `40px`。
- Active 状态使用 Ink 文本、Scholarly Blue 下划线或边框。
- Hover 只改变文字或弱背景，不改变布局尺寸。
- 导航项需要稳定 hit area，不因为图标、徽标或加载态导致宽高跳动。

### Icons

- 默认图标尺寸 `16px`，默认描边约 `1.75`。
- 在 `viewBox="0 0 1024 1024"` 的源 SVG 中，线性图标描边由 token
  推导为 `stroke-width="112"`，即 `112 / 1024 * 16 = 1.75px`。
- 线性图标统一 `stroke-linecap: round` 和 `stroke-linejoin: round`。
- 实心图标保留原始轮廓，不强行描边化。
- 图标按钮必须提供可访问名称，例如 `aria-label` 或可见文本。
- 图标只用于识别动作或状态，不用于填充空白。

## 9. Documentation and Example Tone

文档应像组件规范，而不是品牌宣言。保留设计名称，但用可验证的规则支撑它。

写法要求：

- 少用“高级、极致、奢华、未来感、智能”等不可验证形容词。
- 多写数值、状态、边界和使用场景，例如 Button 高度、Focus Ring、Dropdown 阴影、Dialog padding、Table density。
- 示例文案使用真实任务语境，例如“保存草稿”“发布文章”“同步成员权限”，少用 `Item 1`、`Option A`。
- 每个组件文档都应说明：用途、主要 Props、状态、键盘行为、无障碍要求、相关 tokens、已知限制。
- 当 FsusUI 与 Element Plus 行为一致时直接说明兼容；当存在视觉或交互差异时，说明差异原因和迁移影响。

## 10. Do and Don't

### Do

- 使用左对齐、稳定栅格和清晰行高建立结构。
- 使用 Ink / Paper / Dot Gray 处理大多数界面，使用 Scholarly Blue 处理交互反馈。
- 为每个控件状态提供明确视觉差异：default、hover、active、focus-visible、disabled、loading。
- 在组件规范中优先引用 runtime token。
- 在表格、表单、弹窗等高频场景中优先考虑密度、可读性和键盘操作。
- 引用具体数值而非定性形容词：写 `44px` 而不是"合适的高度"。

#### Do — code examples

引用 token 而非硬编码颜色值：

```html
<!-- ✅ 引用 runtime token -->
<button class="el-button el-button--primary">保存草稿</button>

<!-- ❌ 硬编码颜色，破坏主题切换 -->
<button style="background: #2A599C; color: #FFFFFF;">保存草稿</button>
```

使用稳定 hit area 与对齐基线：

```css
/* ✅ 默认 44px 触控高度 + 6px 圆角 */
.fsus-btn {
  height: var(--fsus-control-height); /* 44px */
  padding-inline: var(--fsus-space-4); /* 16px */
  border-radius: var(--fsus-radius-control); /* 6px */
}

/* ❌ 任意高度 + 大圆角 + 渐变 */
.fsus-btn-bad {
  height: 38px;
  padding-inline: 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, #2A599C, #4B79CC);
}
```

Focus 状态使用 `2px` Scholarly Blue ring：

```css
/* ✅ FsusUI focus-visible */
:focus-visible {
  outline: 2px solid var(--fsus-scholarly-blue);
  outline-offset: 2px;
}

/* ❌ 浏览器默认蓝色 outline */
:focus {
  outline: 2px solid #4B79CC;
}
```

### Don't

- 不使用高饱和霓虹色、彩色渐变、装饰光晕或无意义背景图。
- 不把毛玻璃用于所有页面区块。它只属于浮层与遮罩。
- 不用阴影替代布局层级。布局层级先由 spacing、边框和排版解决。
- 不使用浏览器默认蓝色 outline 替代 FsusUI focus ring。
- 不在组件库示例中堆叠宣传语。组件示例应展示真实状态和真实约束。
- 不使用"高级""极致""智能"等不可验证形容词描述组件。

#### Don't — anti-examples

大面积蓝色背景违反 [§4 Accent Rules](#4-color-and-surface)：

```html
<!-- ❌ 大面积蓝色背景 -->
<section style="background: var(--fsus-scholarly-blue); color: #FFFFFF;">
  <h1>Welcome to FsusUI</h1>
</section>

<!-- ✅ Paper 背景 + Ink 文本 -->
<section style="background: var(--fsus-paper); color: var(--fsus-ink);">
  <h1>Welcome to FsusUI</h1>
</section>
```

毛玻璃不可作为页面背景（仅限浮层）：

```css
/* ❌ 全局毛玻璃 */
body {
  backdrop-filter: blur(12px);
}

/* ✅ 毛玻璃限定到浮层 */
.el-dialog {
  backdrop-filter: var(--fsus-backdrop-blur-overlay);
}
```

文档示例禁用 `Item 1 / Option A` 占位文案：

```html
<!-- ❌ 占位文案 -->
<el-select>
  <el-option label="Option A" value="a" />
  <el-option label="Option B" value="b" />
</el-select>

<!-- ✅ 真实任务语境 -->
<el-select>
  <el-option label="保存草稿" value="draft" />
  <el-option label="发布文章" value="publish" />
</el-select>
```

在表格/表单/弹窗中堆叠宣传语：

```html
<!-- ❌ 组件示例 = 营销页 -->
<el-card>
  <h2>✦ 极致体验，智能未来 ✦</h2>
  <p>欢迎使用下一代设计系统...</p>
</el-card>

<!-- ✅ 组件示例 = 真实任务 -->
<el-card>
  <h3>同步成员权限</h3>
  <p>已选择 3 个成员。权限更新将在 5 分钟内生效。</p>
</el-card>
```

## 11. Token Mapping

### Core Color Tokens

| Visual Concept | Light                 | Runtime Token                           | Dark      |
| -------------- | --------------------- | --------------------------------------- | --------- |
| Ink            | `#0F0F11`             | `--fsus-ink`, `--el-text-color-primary` | `#F0F0F4` |
| Paper          | `#FFFFFF` / `#FCFCFC` | `--fsus-paper`, `--el-bg-color`         | `#121214` |
| Page           | `#F7F7F8`             | `--fsus-page`, `--el-bg-color-page`     | `#09090B` |
| Scholarly Blue | `#2A599C`             | `--fsus-scholarly-blue`                 | `#4B79CC` |
| Dot Gray       | `#A1A1AA` / `#8E8E93` | `--fsus-dot-gray`, `--el-color-info`    | `#71717A` |
| Border         | `#E4E4E7`             | `--fsus-border`, `--el-border-color`    | `#27272A` |

### Surface and Interaction Tokens

| Visual Concept          | Value       | Runtime Token                                             | Notes                      |
| ----------------------- | ----------- | --------------------------------------------------------- | -------------------------- |
| Control radius          | `6px`       | `--fsus-radius-control`, `--el-border-radius-base`        | Button、Input、Select      |
| Small control radius    | `4px`       | `--fsus-radius-control-small`, `--el-border-radius-small` | 小尺寸控件                 |
| Popover radius          | `10px`      | `--fsus-radius-popover`, `--el-popover-border-radius`     | Popover、Tooltip、Dropdown |
| Panel radius            | `12px`      | `--fsus-radius-panel`, `--el-dialog-border-radius`        | Dialog、Drawer、Card       |
| Expressive panel radius | `24px`      | `--fsus-radius-panel-large`                               | Opt-in expressive surfaces |
| Pill radius             | `999px`     | `--fsus-radius-pill`, `--el-border-radius-round`          | Badge、Tag、圆形图标按钮    |
| Control height          | `44px`      | `--fsus-control-height`                                   | 默认控件高度               |
| Compact control height  | `40px`      | `--fsus-control-height-compact`                           | 紧凑控件高度               |
| Focus ring              | `2px inset` | `--fsus-scholarly-blue` / `--el-a11y-focus-color`         | `focus-visible` only       |
| Backdrop blur           | `0px`       | `--fsus-backdrop-blur`                                    | Default paper material     |
| Overlay blur            | `0px`       | `--fsus-backdrop-blur-overlay`                            | Default overlay material   |
| Panel shadow            | `none`      | `--fsus-shadow-panel`, `--el-box-shadow`                  | Border-first panels        |

### Rationale

§11 是 §4–§7 与实现代码之间的查表索引：每一行同时列出 FsusUI 语义 token（`--fsus-*`）与 Element Plus 兼容变量（`--el-*`），下游实现优先引用 `--fsus-*`，`--el-*` 作为迁移期 fallback。新视觉规则必须先在 [`spec/tokens/tokens.json`](../../spec/tokens/tokens.json) 注册 token，再写入此表，最后才进入本文档正文（见 [§12 Source of Truth](#12-source-of-truth)）。

## 12. Source of Truth

- Theme token implementation: [`packages/theme-chalk/src/common/fsus-tokens.scss`](../../packages/theme-chalk/src/common/fsus-tokens.scss)
- Element Plus compatibility variables: [`packages/theme-chalk/src/common/var.scss`](../../packages/theme-chalk/src/common/var.scss)
- Platform-neutral token source: [`spec/tokens/tokens.json`](../../spec/tokens/tokens.json)
- Public token stability: [`docs/theme/tokens.md`](../theme/tokens.md)
- Public motion tokens: [`docs/theme/motion.md`](../theme/motion.md)
- Element Plus 差异说明: [`docs/element-plus-integration.md`](../element-plus-integration.md)
- 公共 API 边界: [`docs/api-stability.md`](../api-stability.md)

新规则必须先在 [`spec/tokens/tokens.json`](../../spec/tokens/tokens.json) 中映射到现有 public token，或新增一个 token，再写进本文件。

## 13. Terminology

本文档混合中文叙述与英文术语，约定如下，确保任何修改者与读者使用同一套词汇。

### 13.1 组件名

保留 PascalCase 英文组件名（不翻译、不拼音化）：`Dialog`, `Drawer`, `Button`, `Input`, `Select`, `Dropdown`, `Popover`, `Tooltip`, `Card`, `Table`, `Tabs`, `Tag`, `Switch`, `Slider`, `Menu`, `Form`, `Message`, `Notification`, `MessageBox`, `Popconfirm`, `Tree`, `Cascader`, `ColorPicker`, `DatePicker`, `TimePicker`, `Upload`, `Image`, `Avatar`。

### 13.2 角色词

组件角色使用中文：按钮 / 输入框 / 下拉面板 / 弹窗 / 抽屉 / 卡片 / 表格行 / 列表项 / 表单域 / 状态标签 / 提示信息 / 确认对话框 / 通知 / 加载占位 / 空状态。

### 13.3 设计语言词汇

| 英文 | 中文 | 含义 |
| --- | --- | --- |
| Ink | 主墨色 | 主要文本与品牌字标 |
| Paper | 纸面色 | 控件与浮层表面 |
| Page | 页面底 | 页面背景 |
| Dot Gray | 句点灰 | 次级文本、弱边框、禁用态 |
| Scholarly Blue | 学术蓝 | 仅用于功能性反馈：链接、选中、焦点、Hover |
| Border-first | 边框优先 | 边框先于阴影定义表面层级 |
| Paper material | 纸面材质 | 实色表面，不使用模糊或光晕 |
| Glass material | 玻璃材质 | opt-in 浮层材质，通过 `.is-glass` 或 `[data-fsus-material='glass']` 启用 |
| Opt-in expressive surface | opt-in 表达面 | `[data-fsus-surface='expressive']`，启用 `24px` 圆角 |
| Reading surface | 阅读面 | `[data-fsus-surface='reading']`，禁用玻璃、motion trail、glow |
| Firm Yet Soft | 精确而柔和 | 结构精确，控件边缘柔和 |
| Ivy / Editorial Restraint | 学术编辑克制 | 学术出版物的克制与耐看质感 |
| Swiss Graphic Design | 瑞士平面设计 | 左对齐、明确网格、清晰层级 |
| Punctuation | 标点 | 品牌母题：句点作为列表符号、标题锚点、加载记号 |

### 13.4 Token、CSS 类名、ARIA

所有 token 名、CSS 类名、属性值、ARIA 属性原样保留英文：`--fsus-*`, `--el-*`, `.is-glass`, `data-fsus-surface`, `data-fsus-material`, `aria-label`, `aria-disabled`, `aria-invalid`, `aria-busy`, `aria-live`。

### 13.5 描述性形容词黑名单

以下形容词禁止用于组件描述（见 [§9 Documentation and Example Tone](#9-documentation-and-example-tone)）：高级 / 极致 / 奢华 / 未来感 / 智能 / 大气 / 简约而不简单 / 沉浸式。改用具体数值（`44px`）、状态（`focus-visible`）、边界条件（`max-height: 274px`）替代。

> **Material update:** Current defaults are paper/document-first, not
> glass/SaaS-first. Backdrop blur tokens default to `0px`; glass material is
> opt-in through `.is-glass` or `[data-fsus-material='glass']`. Ordinary
> controls use `6px` radius, small controls use `4px`, and ordinary cards,
> panels, dialogs, drawers, and popovers use `12px` or less by default. The
> `24px` panel radius is available only for expressive opt-in surfaces through
> `[data-fsus-surface='expressive']` or equivalent component context. Ordinary
> panels are border-first and default to `--fsus-shadow-panel: none`.
> `[data-fsus-surface='reading']` disables glass, motion trails, and glow so
> FsusBlog article pages, MarkdownRenderer, TOC, article lists, and comments
> keep a paper/document feel. MarkdownRenderer loading states use neutral
> document placeholders by default, with no accent shimmer or pulse.
