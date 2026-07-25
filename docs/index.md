# FsusUI 文档中心

FsusUI 是基于 Vue 3 与 Element Plus 兼容面的跨平台组件系统。当前 npm public-preview 主包为 `@ozwasyd/element-plus`。本文只负责导航；设计、规范、API 和验证规则以各自的权威文档为准。

## 从你的任务开始

| 任务 | 首要入口 | 后续文档 |
| --- | --- | --- |
| 安装和使用 Web/Vue 包 | [快速开始](./guide/quickstart.md) | [安装](./guide/installation.md)、[主题](./guide/theming.md)、[组件总览](./components/overview.md) |
| 修改 FsusUI 视觉或交互 | [设计文档地图](./design/README.md) | [设计合同](./design.md)、[变更归类](./design/change-classification.md)、[视觉变更流程](./workflows/visual-change.md) |
| 在 FsusBlog 或其他产品中调用 FsusUI | [调用方文档](./consumers/README.md) | [设计集成边界](./consumers/design-integration.md)、[FsusBlog 示例](./ux/fsusblog-consumption-examples.md) |
| 修改 token、motion 或主题 | [主题 token](./theme/tokens.md) | [canonical spec](../spec/tokens/README.md)、[motion](./theme/motion.md)、[customization](./theme/customization.md) |
| 修改 Web/Vue 组件 | [组件总览](./components/overview.md) | 对应组件文档、[API 稳定性](./api-stability.md)、[视觉测试](./visual-testing.md) |
| 修改 Avalonia/.NET | [Avalonia 文档](./avalonia/README.md) | [平台差异](./avalonia/platform-differences.md)、[Vue 迁移](./avalonia/vue-migration.md) |
| 理解仓库或跨平台结构 | [架构文档](./architecture/README.md) | [项目概览](./project-overview.md)、[spec 架构](../spec/architecture.md) |
| 维护、验证或发布 | [工作流文档](./workflows/README.md) | [工程交接](./engineering-handoff.md)、[治理](./governance/README.md)、[发布治理](./release-governance.md) |

## 文档权威顺序

1. [`spec/`](../spec/README.md)：平台中立、机器可验证的 canonical 合同。
2. [`docs/design.md`](./design.md)：唯一的人类可读视觉设计合同。
3. API、theme、UX、component、Avalonia 等领域合同。
4. governance 与 workflow：解释如何分类、变更和验证，不重定义设计值。
5. guide、consumer 文档和示例：说明如何采用公开合同。
6. generated、release、benchmark、audit 与 archive：派生输出或时间点记录。

详细的文档角色、目录和新增文件放置规则见 [Documentation Architecture](./governance/documentation-architecture.md)。

## 文档领域

| 领域 | 入口 | 内容 |
| --- | --- | --- |
| 设计系统 | [docs/design/](./design/README.md) | 设计合同、解释规则、变更归类、UX 与视觉证据 |
| 平台中立规范 | [spec/](../spec/README.md) | tokens、组件合同、interaction、a11y、motion、platform overrides |
| 架构 | [docs/architecture/](./architecture/README.md) | monorepo、runtime、跨平台、API 边界 |
| Web/Vue 组件 | [组件总览](./components/overview.md) | 组件 API、状态、键盘行为、tokens 与限制 |
| Avalonia | [Avalonia adoption](./avalonia/README.md) | .NET 包、组件、平台差异和迁移 |
| 调用方 | [docs/consumers/](./consumers/README.md) | FsusUI 与产品的所有权、集成和消费示例 |
| 使用指南 | [docs/guide/](./guide/quickstart.md) | 安装、主题、暗色、i18n、SSR、namespace、默认值 |
| 工作流 | [docs/workflows/](./workflows/README.md) | 维护、视觉变更、测试、Demo 与发布执行 |
| 治理 | [docs/governance/](./governance/README.md) | 文档、设计、API、CI、兼容性和发布治理 |
| 迁移与兼容 | [Element Plus 兼容](./element-plus-compatibility.md) | 接入、迁移、包名和支持边界 |
| 版本与证据 | [Public Preview](./releases/public-preview.md) | release/readiness、性能、审计和发布证据 |

## 稳定顶层入口

以下路径被脚本、测试、贡献指南或外部链接直接引用，因此暂时保留在 `docs/` 根目录；它们已在上述领域入口中归类：

- [设计合同](./design.md)
- [项目概览](./project-overview.md)
- [工程维护交接](./engineering-handoff.md)
- [Visual test profiles](./visual-testing.md)
- [发布治理](./release-governance.md)
- [API 稳定性](./api-stability.md)
- [Element Plus 接入](./element-plus-integration.md)
- [Element Plus 兼容](./element-plus-compatibility.md)
- [图标系统](./icons.md)
- [Playground / Demo](./playground.md)

新文档默认不得继续堆到 `docs/` 根目录。先按 [Documentation Architecture](./governance/documentation-architecture.md) 选择领域。

## 关键公共文档

- [贡献指南](../CONTRIBUTING.md)
- [安全策略](../SECURITY.md)
- [行为准则](../CODE_OF_CONDUCT.md)
- [许可与归属](./legal/element-plus-attribution.md)
- [从 Element Plus 迁移](./migration/from-element-plus.md)
- [Public Preview 发布说明](./releases/public-preview.md)

> **Name note:** FsusUI is the recommended public-facing name for this fork and compatibility-focused Vue 3 component library based on Element Plus. Element Plus remains the upstream provenance and API-alignment context. The current npm public-preview package is `@ozwasyd/element-plus`, which maps to the FsusUI compatibility build rather than the upstream package.
