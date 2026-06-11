# FsusUI 文档中心

FsusUI 是基于 Vue 3 的高智感极简主义组件库（The Intellectual Minimalist），采用 pnpm monorepo 架构；当前对外 GitHub Packages 主包为 `@ozwasyd/element-plus`。

---

## 工程文档

| 文档                                                       | 说明                                            |
| ---------------------------------------------------------- | ----------------------------------------------- |
| [项目概览](./project-overview.md)                          | Monorepo 结构、工作区划分、主要入口             |
| [设计规范](./design.md)                                    | 高智感极简主义设计语言、色彩、字体、组件规范    |
| [Element Plus 接入指南](./element-plus-integration.md)     | 与 Element Plus 的差异点、包名约定、WASM 策略   |
| [API 稳定性](./api-stability.md)                           | public preview 导出、稳定性等级、内部路径边界   |
| [Element Plus 兼容策略](./element-plus-compatibility.md)   | 兼容承诺、已知差异、支持与不支持的使用面        |
| [从 Element Plus 迁移](./migration/from-element-plus.md)   | 包名、CSS、图标、运行时目标与迁移检查           |
| [工程维护交接](./engineering-handoff.md)                   | 环境基线、标准命令、CI 分工、常见问题排查       |
| [发布治理](./release-governance.md)                        | GitHub Packages 发布流程、Changesets 版本管理   |
| [npm 发布策略](./release/npm-registry-policy.md)           | npm registry、provenance、dist-tag 与包审计策略 |
| [模板审计报告](./runtime-template-audit.md)                | 模板 DOM 扫描结果（Wave 0 已全部完成）          |
| [模板重构计划](./runtime-template-refactor-plan.md)        | 模板重构 Guardrails 与审计命令                  |
| [UX 语义指南](./ux/dont-make-me-think-guidelines.md)       | Don’t Make Me Think 风格约束与检查器规则        |
| [任务导向组件语义](./ux/task-oriented-components.md)       | 页面任务、危险操作、空状态、筛选摘要等契约      |
| [FsusBlog 消费示例](./ux/fsusblog-consumption-examples.md) | 内容后台消费 UX 语义模式的组合示例              |

---

## 使用指南

| 文档                                          | 说明                                                   |
| --------------------------------------------- | ------------------------------------------------------ |
| [安装](./guide/installation.md)               | 环境要求、通过 GitHub Packages 安装、配置 `.npmrc`     |
| [快速开始](./guide/quickstart.md)             | 全量引入、按需引入、全局配置                           |
| [主题定制](./guide/theming.md)                | CSS 变量覆盖、SCSS 变量、FsusUI 学术蓝配色规范         |
| [主题 Token 稳定性](./theme/tokens.md)        | 公开主题变量、实验变量、内部变量边界                   |
| [Motion Token 稳定性](./theme/motion.md)      | ConfigProvider motion、公开动效 token、低动效策略      |
| [暗色模式](./guide/dark-mode.md)              | 接入 `themeMode`、跟随系统主题、自定义暗色变量         |
| [国际化](./guide/i18n.md)                     | 多语言切换、Day.js 时区配置                            |
| [自定义命名空间](./guide/namespace.md)        | 修改组件 CSS 类名前缀                                  |
| [服务端渲染 (SSR)](./guide/ssr.md)            | SSR 水合错误处理、Teleport 注入                        |
| [自定义默认值](./guide/custom-defaults.md)    | `setPropsDefaults` 用法与限制                          |
| [Render Pipeline](./guide/render-pipeline.md) | 统一渲染预算、外部 adapter、Worker 与虚拟挂载          |
| [Result Mode](./guide/result-mode.md)         | `FsusResult<T>`、错误码、可恢复失败迁移与 release gate |

---

## 组件文档

### 基础组件

| 组件                             | 文档                                                                 |
| -------------------------------- | -------------------------------------------------------------------- |
| 按钮 Button                      | [components/button.md](./components/button.md)                       |
| 图标 Icon                        | [components/icon.md](./components/icon.md)                           |
| 链接 Link                        | [components/link.md](./components/link.md)                           |
| 文本 Text                        | [components/text.md](./components/text.md)                           |
| 公共页面外壳 PublicShell         | [components/public-shell.md](./components/public-shell.md)           |
| Markdown 渲染器 MarkdownRenderer | [components/markdown-renderer.md](./components/markdown-renderer.md) |
| Markdown 编辑器 MarkdownEditor   | [components/markdown-editor.md](./components/markdown-editor.md)     |
| 滚动条 Scrollbar                 | [components/scrollbar.md](./components/scrollbar.md)                 |
| 间距 Space                       | [components/space.md](./components/space.md)                         |
| 布局 Layout                      | [components/layout.md](./components/layout.md)                       |
| 分割线 Divider                   | [components/divider.md](./components/divider.md)                     |

### 表单组件

| 组件                   | 文档                                                       |
| ---------------------- | ---------------------------------------------------------- |
| 输入框 Input           | [components/input.md](./components/input.md)               |
| 数字输入框 InputNumber | [components/input-number.md](./components/input-number.md) |
| 选择器 Select          | [components/select.md](./components/select.md)             |
| 虚拟化选择器 SelectV2  | [components/select-v2.md](./components/select-v2.md)       |
| 单选框 Radio           | [components/radio.md](./components/radio.md)               |
| 多选框 Checkbox        | [components/checkbox.md](./components/checkbox.md)         |
| 级联选择器 Cascader    | [components/cascader.md](./components/cascader.md)         |
| 表单 Form              | [components/form.md](./components/form.md)                 |
| 日期选择器 DatePicker  | [components/date-picker.md](./components/date-picker.md)   |
| 时间选择器 TimePicker  | [components/time-picker.md](./components/time-picker.md)   |
| 时间选择 TimeSelect    | [components/time-select.md](./components/time-select.md)   |
| 开关 Switch            | [components/switch.md](./components/switch.md)             |
| 滑块 Slider            | [components/slider.md](./components/slider.md)             |
| 上传 Upload            | [components/upload.md](./components/upload.md)             |
| 评分 Rate              | [components/rate.md](./components/rate.md)                 |
| 颜色选择器 ColorPicker | [components/color-picker.md](./components/color-picker.md) |
| 穿梭框 Transfer        | [components/transfer.md](./components/transfer.md)         |

### 数据展示

| 组件                    | 文档                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| 表格 Table              | [components/table.md](./components/table.md)                     |
| 虚拟化表格 TableV2      | [components/table-v2.md](./components/table-v2.md)               |
| 虚拟列表 VirtualList    | [components/virtual-list.md](./components/virtual-list.md)       |
| 分页 Pagination         | [components/pagination.md](./components/pagination.md)           |
| 树形控件 Tree           | [components/tree.md](./components/tree.md)                       |
| 虚拟树 TreeV2           | [components/tree-v2.md](./components/tree-v2.md)                 |
| 树形选择 TreeSelect     | [components/tree-select.md](./components/tree-select.md)         |
| 自动补全 Autocomplete   | [components/autocomplete.md](./components/autocomplete.md)       |
| 头像 Avatar             | [components/avatar.md](./components/avatar.md)                   |
| 徽章 Badge              | [components/badge.md](./components/badge.md)                     |
| 日历 Calendar           | [components/calendar.md](./components/calendar.md)               |
| 卡片 Card               | [components/card.md](./components/card.md)                       |
| 走马灯 Carousel         | [components/carousel.md](./components/carousel.md)               |
| 折叠面板 Collapse       | [components/collapse.md](./components/collapse.md)               |
| 倒计时 Countdown        | [components/countdown.md](./components/countdown.md)             |
| 描述列表 Descriptions   | [components/descriptions.md](./components/descriptions.md)       |
| 空状态 Empty            | [components/empty.md](./components/empty.md)                     |
| 图片 Image              | [components/image.md](./components/image.md)                     |
| 无限滚动 InfiniteScroll | [components/infinite-scroll.md](./components/infinite-scroll.md) |
| 统计数值 Statistic      | [components/statistic.md](./components/statistic.md)             |
| 标签 Tag                | [components/tag.md](./components/tag.md)                         |
| 时间线 Timeline         | [components/timeline.md](./components/timeline.md)               |
| 水印 Watermark          | [components/watermark.md](./components/watermark.md)             |
| 骨架屏 Skeleton         | [components/skeleton.md](./components/skeleton.md)               |

### 导航

| 组件              | 文档                                                     |
| ----------------- | -------------------------------------------------------- |
| 导航菜单 Menu     | [components/menu.md](./components/menu.md)               |
| 标签页 Tabs       | [components/tabs.md](./components/tabs.md)               |
| 面包屑 Breadcrumb | [components/breadcrumb.md](./components/breadcrumb.md)   |
| 页头 PageHeader   | [components/page-header.md](./components/page-header.md) |
| 下拉菜单 Dropdown | [components/dropdown.md](./components/dropdown.md)       |
| 步骤条 Steps      | [components/steps.md](./components/steps.md)             |
| 固钉 Affix        | [components/affix.md](./components/affix.md)             |
| 回到顶部 Backtop  | [components/backtop.md](./components/backtop.md)         |

### 反馈

| 组件                  | 文档                                                       |
| --------------------- | ---------------------------------------------------------- |
| 警告 Alert            | [components/alert.md](./components/alert.md)               |
| 对话框 Dialog         | [components/dialog.md](./components/dialog.md)             |
| 抽屉 Drawer           | [components/drawer.md](./components/drawer.md)             |
| 加载 Loading          | [components/loading.md](./components/loading.md)           |
| 消息 Message          | [components/message.md](./components/message.md)           |
| 消息弹框 MessageBox   | [components/message-box.md](./components/message-box.md)   |
| 通知 Notification     | [components/notification.md](./components/notification.md) |
| 气泡卡片 Popover      | [components/popover.md](./components/popover.md)           |
| 气泡确认框 Popconfirm | [components/popconfirm.md](./components/popconfirm.md)     |
| 文字提示 Tooltip      | [components/tooltip.md](./components/tooltip.md)           |
| 进度条 Progress       | [components/progress.md](./components/progress.md)         |
| 结果 Result           | [components/result.md](./components/result.md)             |

### 配置

| 组件                    | 文档                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| 全局配置 ConfigProvider | [components/config-provider.md](./components/config-provider.md) |
