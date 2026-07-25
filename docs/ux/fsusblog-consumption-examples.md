# FsusBlog 消费示例

> **Role:** Non-normative consumer example
> **Applies to:** FsusBlog as one FsusUI consumer
> **Authority:** Demonstrates [`docs/consumers/design-integration.md`](../consumers/design-integration.md) and UX contracts. It does not define FsusUI defaults or FsusBlog route-level design rules.

这些示例展示内容后台如何消费 FsusUI 的 UX 语义模式，不绑定具体业务流程。可运行的 Vue 片段放在 `examples/ux-semantics`，并由 `npm run check:ux-semantics` 校验。FsusBlog 的公开、阅读和产品级页面构图仍由 FsusBlog 自己的设计规则拥有；示例不得反向扩张 FsusUI 的 task-surface 默认值。

## 文章编辑器

使用 `TaskPageHeader` 表达编辑位置和下一步动作，使用 `ContextBar` 表达当前文章、作者、保存状态。保存、发布等异步动作必须暴露 pending、成功、失败状态。

参考：`examples/ux-semantics/article-editor.vue`

## 评论审核

使用 `FilterStateSummary` 说明当前筛选条件，使用 `RecommendationBanner` 解释建议通过或拒绝的原因，使用 `DangerAction` 约束拒绝、隐藏、永久删除等操作。

参考：`examples/ux-semantics/comment-moderation.vue`

## 消息中心

使用 `ContextBar` 说明正在回复的对象和状态。消息为空时，`EmptyState` 说明为空原因，并提供返回全部消息或清除筛选动作。

参考：`examples/ux-semantics/message-center.vue`

## Dashboard 今日待处理

使用任务摘要说明今天有哪些待处理项，使用推荐动作降低决策成本。长时间加载用 skeleton 或状态文本，不留下空白区域。

参考：`examples/ux-semantics/dashboard-today.vue`

## 管理导航分组

使用清晰分组标题和上下文说明表达当前管理范围。隐藏、关闭、删除导航组等危险动作必须预告影响范围、可恢复性、通知和审计。

参考：`examples/ux-semantics/admin-navigation.vue`
