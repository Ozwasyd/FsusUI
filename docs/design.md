# FsusUI Design System: The Intellectual Minimalist

## 1. Scope and Intent

FsusUI 2026 的设计语言定义为 **The Intellectual Minimalist（高智感极简主义）**。它不是一组装饰风格，而是一套用于组件库实现、文档示例和产品集成的设计约束。

核心目标：

- 用清晰的排版、稳定的栅格和克制的颜色建立专业感。
- 保留 Element Plus 的可迁移性，同时形成 FsusUI 自己的视觉识别。
- 让组件在管理后台、内容编辑、知识产品和工具型界面中保持长期可读、可维护、可扩展。

这套语言由三类原则组成：

1. **Swiss Graphic Design**: 使用左对齐、明确网格、充分留白和清晰的信息层级，避免无意义的装饰。
2. **Ivy / Editorial Restraint**: 借鉴学术出版物的克制、耐看和低调质感，重点放在内容与结构，而不是视觉噱头。
3. **Firm Yet Soft**: 结构要精确，控件边缘和交互反馈要柔和。微圆角、细描边和低强度阴影用于降低机械感，但不能削弱界面秩序。

## 2. Brand Motif: Punctuation

FsusUI 从 `Fsu's Blog.` 的句点中提取 **Punctuation Mark（标点）** 作为品牌识别元素。

使用规则：

- 句点可以作为列表符号、标题锚点、加载状态或空状态中的微型视觉记号。
- 句点必须服务于信息结构，不作为大面积装饰图形使用。
- 句点颜色默认使用 `--fsus-dot-gray` / `--el-color-info`，避免使用强调色抢占交互语义。
- 同一视图中不要重复使用过多句点装饰。页面级标题、列表和加载状态三者同时出现时，只保留信息最明确的一处。

## 3. Typography

排版是 FsusUI 的主要视觉载体。字体、字号、行高和对齐方式应优先解决可读性与信息层级。

### Typeface

- Latin and numbers: `Google Sans`
- CJK: `Noto Sans CJK` / `Noto Sans SC`
- Fallback: `PingFang SC`, `Microsoft YaHei`, `Helvetica Neue`, `Arial`, `sans-serif`

### Layout Rules

- 正文和主要信息默认左对齐，使用 ragged right，不做两端对齐。
- 大段文本禁止居中。居中只用于结构明确的小组件，例如空状态、结果页或确认弹窗的标题区。
- 层级通过字号、字重、行高和留白建立，不通过颜色堆叠建立。
- 默认正文为 `14px`，小型说明为 `12px` 或 `13px`，标题按组件语境使用 `16px`、`18px`、`20px` 或页面级更大字号。
- 不使用负字距。大标题也应保持自然字距，避免制造人为的“高级感”。

## 4. Color and Surface

FsusUI 的色彩系统围绕 **Ink / Paper / Dot / Scholarly Blue** 展开。颜色承担明确职责：文本、背景、结构、交互反馈。

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

## 5. Space, Radius, and Density

界面结构以 4px 间距阶梯为基础，使用明确的控件高度和面板半径。组件库文档、设计稿和实现都应优先引用 token，而不是手写一次性数值。

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

| Surface       | Value   | Token                                              | Usage                                |
| ------------- | ------- | -------------------------------------------------- | ------------------------------------ |
| Small control | `6px`   | `--fsus-radius-control-small`                      | 小尺寸按钮、紧凑输入、标签内部结构   |
| Control       | `8px`   | `--fsus-radius-control`, `--el-border-radius-base` | Button、Input、Select、Checkbox 外框 |
| Popover       | `20px`  | `--fsus-radius-popover`                            | Tooltip、Popover、Dropdown 内层面板  |
| Panel         | `24px`  | `--fsus-radius-panel`, `--el-dialog-border-radius` | Dialog、Drawer、Card、MessageBox     |
| Pill          | `999px` | `--fsus-radius-pill`, `--el-border-radius-round`   | Badge、圆形图标按钮、胶囊标签        |

### Density

- 默认控件高度：`44px`
- 大号控件高度：`48px`
- 紧凑控件高度：`40px`
- 图标按钮触控目标：`40px`
- 表格默认行内 padding：`12px 0`
- 表格紧凑行内 padding：`10px 0`
- 表格大尺寸行内 padding：`14px 0`

密度只能表达任务场景，不表达视觉偏好。数据管理、日志、表格操作使用紧凑密度；表单录入和配置页使用默认密度；营销式展示页不应反向污染组件库默认密度。

## 6. Depth and Material

FsusUI 使用低透明度阴影、轻量玻璃和细边框表达层级。材质效果必须能解释信息结构或交互状态。

### Overlay Material

- 浮层背景使用 `--fsus-surface-overlay`，默认约 `rgba(255, 255, 255, 0.85)`。
- 主浮层模糊使用 `--fsus-backdrop-blur: 40px`。
- 次级浮层或轻量面板使用 `--fsus-backdrop-blur-soft: 20px`。
- 遮罩层使用 `--fsus-backdrop-blur-overlay: 16px`。
- 毛玻璃只用于 Dialog、Drawer、Dropdown、Popover、Notification 等悬浮层。静态页面区块、表格单元格和常规表单区域不使用毛玻璃。

### Shadow

| Token                         | Value                                               | Usage                      |
| ----------------------------- | --------------------------------------------------- | -------------------------- |
| `--fsus-shadow-panel`         | `0 32px 64px rgba(0, 0, 0, 0.08)` + inner highlight | Dialog、Card、主要浮层     |
| `--fsus-shadow-panel-light`   | `0 14px 40px rgba(0, 0, 0, 0.08)` + inner highlight | Dropdown、Popover          |
| `--fsus-shadow-panel-lighter` | `0 8px 24px rgba(0, 0, 0, 0.06)` + inner highlight  | 低层级浮起元素             |
| `--fsus-shadow-floating`      | `0 24px 60px rgba(15, 23, 42, 0.12)`                | Notification、临时悬浮提示 |

避免使用重黑投影、彩色光晕和无层级意义的外发光。

## 7. Motion

动效用于解释状态变化，不用于制造视觉存在感。

| Token                        | Value                          | Usage                                 |
| ---------------------------- | ------------------------------ | ------------------------------------- |
| `--fsus-motion-control-fast` | `140ms`                        | Checkbox、Radio、Switch 的即时反馈    |
| `--fsus-motion-control`      | `220ms`                        | Button、Input、Tag、Tab 等控件状态    |
| `--fsus-motion-overlay`      | `300ms`                        | 遮罩淡入淡出                          |
| `--fsus-motion-panel`        | `360ms`                        | Dialog、Drawer、Dropdown 的进入与离开 |
| `--fsus-motion-standard`     | `cubic-bezier(0.4, 0, 0.2, 1)` | 默认缓动                              |
| `--fsus-motion-emphasized`   | `cubic-bezier(0.2, 0, 0, 1)`   | 浮层进入、重点内容揭示                |

规则：

- 控件 Hover 不超过 `translateY(-1px)`。
- 面板进入位移控制在 `8px` 到 `20px`。
- 禁止弹跳、过冲和循环装饰动画。
- 必须支持 `prefers-reduced-motion: reduce`，将非必要动画降至 `1ms` 或移除 transform。

## 8. Component Implementation Rules

### Button

- 默认高度 `44px`，大号 `48px`，小号 `40px`。
- 默认水平 padding `16px`，大号 `20px`，小号 `12px`。
- 图标与文字间距：默认 `6px`，大号 `8px`，小号 `4px`。
- Primary 默认使用 Ink Black，白色文字，无额外描边。
- Primary Hover 使用 `Scholarly Blue`，允许 `translateY(-1px)` 和 `--el-box-shadow-light`。
- Secondary / Ghost 使用透明或 Paper 背景、`1px` 边框和 Ink 文本。
- Focus Visible 必须使用 `2px` inset focus ring：`var(--fsus-scholarly-blue)`。
- Loading 态遮罩必须继承按钮圆角，不改变按钮宽高。

### Form Controls

- Input、Select、Textarea 默认圆角 `8px`，边框 `1px solid var(--el-border-color)`。
- Input 默认高度 `44px`，大号 `48px`，小号 `40px`。
- Input 水平 padding 默认 `12px`，大号 `16px`，小号 `8px`。
- Focus Visible 使用 `2px` inset blue ring，禁用浏览器默认 outline。
- Invalid 状态优先显示语义色和错误文案，不用动画或强烈外发光吸引注意。
- Disabled 状态使用 `--el-disabled-bg-color`、`--el-disabled-text-color`、`--el-disabled-border-color`，透明度不能低到影响可读性。

### Dropdown, Select, Popover

- Dropdown 面板默认 padding `8px 0`，最大高度 `274px`。
- Popover 半径使用 `20px`；Select Dropdown 可使用大圆角以匹配浮层语言。
- 阴影使用 `--el-box-shadow-light`，不要叠加额外外发光。
- 选中项用 `Scholarly Blue` 或浅蓝背景表达，不使用高饱和整行色块。
- 列表项需要稳定高度，Hover、Active、Disabled 三种状态必须可区分。

### Dialog and Drawer

- Dialog 默认宽度 `50%`，默认顶部间距 `15vh`。
- 面板圆角 `24px`，主 padding `24px`。
- Header、Body、Footer 必须共享同一左右内边距，关闭按钮与标题基线保持明确关系。
- 关闭按钮触控区域 `54px`，Focus Visible 使用圆形 `2px` ring。
- Overlay 使用半透明 Paper 与 `16px` backdrop blur，不能变成沉重黑色遮罩。
- Drawer 与 Dialog 使用同一层级语言：玻璃、24px 面板圆角、低透明度阴影。

### Table

- 表格优先服务扫描、比较和重复操作，不做卡片化单元格。
- 默认字号 `14px`，小尺寸 `12px`。
- 单元格水平 padding：默认 `16px`，大号 `18px`，小号 `12px`。
- 行 Hover 使用 `--el-fill-color-light`，当前行使用低饱和选中背景。
- 固定列阴影只表达遮挡关系，不作为装饰。
- 操作列中的按钮应使用 inline action 风格，避免在密集表格中出现抬升、缩放或大阴影。

### Tabs and Navigation

- Tabs header 默认高度 `40px`。
- Active 状态使用 Ink 文本、Scholarly Blue 下划线或边框。
- Hover 只改变文字或弱背景，不改变布局尺寸。
- 导航项需要稳定 hit area，不能因为图标、徽标或加载态导致宽高跳动。

### Icons

- 默认图标尺寸 `16px`，默认描边约 `1.75`。
- 线性图标应统一 `stroke-linecap: round` 和 `stroke-linejoin: round`。
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
- 当 FsusUI 与 Element Plus 行为一致时，直接说明兼容；当存在视觉或交互差异时，说明差异原因和迁移影响。

## 10. Do and Don't

### Do

- 使用左对齐、稳定栅格和清晰行高建立结构。
- 使用 Ink / Paper / Dot Gray 处理大多数界面，使用 Scholarly Blue 处理交互反馈。
- 为每个控件状态提供明确视觉差异：default、hover、active、focus-visible、disabled、loading。
- 在组件规范中优先引用 runtime token。
- 在表格、表单、弹窗等高频场景中优先考虑密度、可读性和键盘操作。

### Don't

- 不使用高饱和霓虹色、彩色渐变、装饰光晕或无意义背景图。
- 不把毛玻璃用于所有页面区块。它只属于浮层与遮罩。
- 不用阴影替代布局层级。布局层级先由 spacing、边框和排版解决。
- 不使用浏览器默认蓝色 outline 替代 FsusUI focus ring。
- 不在组件库示例中堆叠宣传语。组件示例应展示真实状态和真实约束。

## 11. Token Mapping

### Core Color Tokens

| Visual Concept | Light                 | Runtime Token                           | Dark      |
| -------------- | --------------------- | --------------------------------------- | --------- |
| Ink            | `#0F0F11`             | `--fsus-ink`, `--el-text-color-primary` | `#F0F0F4` |
| Paper          | `#FFFFFF` / `#FCFCFC` | `--fsus-paper`, `--el-bg-color`         | `#121214` |
| Page           | `#F7F7F8`             | `--fsus-page`, `--el-bg-color-page`     | `#09090B` |
| Scholarly Blue | `#2A599C`             | `--fsus-scholarly-blue`                 | `#4B79CC` |
| Dot Gray       | `#A1A1AA`             | `--fsus-dot-gray`, `--el-color-info`    | `#71717A` |
| Border         | `#E4E4E7`             | `--fsus-border`, `--el-border-color`    | `#27272A` |

### Surface and Interaction Tokens

| Visual Concept         | Value                             | Runtime Token                                             | Notes                      |
| ---------------------- | --------------------------------- | --------------------------------------------------------- | -------------------------- |
| Control radius         | `8px`                             | `--fsus-radius-control`, `--el-border-radius-base`        | Button、Input、Select      |
| Small control radius   | `6px`                             | `--fsus-radius-control-small`, `--el-border-radius-small` | 小尺寸控件                 |
| Popover radius         | `20px`                            | `--fsus-radius-popover`, `--el-popover-border-radius`     | Popover、Tooltip、Dropdown |
| Panel radius           | `24px`                            | `--fsus-radius-panel`, `--el-dialog-border-radius`        | Dialog、Drawer、Card       |
| Control height         | `44px`                            | `--fsus-control-height`                                   | 默认控件高度               |
| Compact control height | `40px`                            | `--fsus-control-height-compact`                           | 紧凑控件高度               |
| Focus ring             | `2px inset`                       | `--fsus-scholarly-blue` / `--el-a11y-focus-color`         | `focus-visible` only       |
| Backdrop blur          | `40px`                            | `--fsus-backdrop-blur`                                    | 主浮层                     |
| Overlay blur           | `16px`                            | `--fsus-backdrop-blur-overlay`                            | 遮罩层                     |
| Panel shadow           | `0 32px 64px rgba(0, 0, 0, 0.08)` | `--fsus-shadow-panel`, `--el-box-shadow`                  | Light mode                 |

## 12. Source of Truth

- Theme token implementation: `packages/theme-chalk/src/common/fsus-tokens.scss`
- Element Plus compatibility variables: `packages/theme-chalk/src/common/var.scss`
- Platform-neutral token source: `spec/tokens/tokens.json`
- Public token stability: `docs/theme/tokens.md`

Any new visual rule should either map to an existing public token or introduce a token through `spec/tokens/tokens.json` before becoming part of this document.
