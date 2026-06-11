# 任务导向组件语义

本文件定义 FsusUI 的 UX 语义组件契约。实现可以是组件、组合式函数、文档化模式或业务侧封装，但消费侧必须能表达这些语义，并通过 `npm run check:ux-semantics` 阻断关键回归。

## 通用类型

```ts
interface ActionSpec {
  label: string
  description?: string
  disabledReason?: string
  pendingLabel?: string
  successLabel?: string
  errorLabel?: string
}

interface BreadcrumbItem {
  label: string
  href?: string
}

interface StatusSpec {
  label: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}
```

## TaskPageHeader

`TaskPageHeader` 必须回答：我在哪里、这里可以做什么、下一步主要动作是什么。

```ts
interface TaskPageHeaderProps {
  title: string
  description?: string
  primaryAction?: ActionSpec
  secondaryActions?: ActionSpec[]
  breadcrumbs?: BreadcrumbItem[]
}
```

语义要求：

- 页面只有一个主标题。
- `description` 描述任务范围、当前对象或当前状态。
- `primaryAction` 使用结果型文案，不使用“确定、提交、确认、OK、Submit、Confirm”。

## TaskActionBar

`TaskActionBar` 放置页面级操作，主动作只能有一个。次动作按风险和频率排序，危险操作与普通次动作分组。

```ts
interface TaskActionBarProps {
  primaryAction?: ActionSpec
  secondaryActions?: ActionSpec[]
  dangerAction?: DangerActionSpec
}
```

## TaskPrimaryAction

`TaskPrimaryAction` 表示用户完成当前任务的下一步。它必须有结果型文案，并为异步动作提供 pending、成功、失败状态。

## TaskSecondaryAction

`TaskSecondaryAction` 表示可选路径，例如预览、保存草稿、复制链接、返回列表。它不能抢占主动作视觉优先级。

## DangerAction

`DangerAction` 必须声明动作名称、是否可恢复、是否通知用户、是否写入审计、确认文案和后果说明。

```ts
interface DangerActionSpec extends ActionSpec {
  confirmation?: string
  undo?: ActionSpec
  consequence: string
  reversible: boolean
  notifiesUsers: boolean
  auditLogged: boolean
}
```

语义要求：

- 必须要求 confirmation 或 undo。
- 永久性操作必须显式显示不可恢复。
- 影响其他用户的操作必须说明是否通知用户。
- 写审计日志的操作应说明会记录。

## EmptyState

`EmptyState` 必须回答为什么为空、用户下一步能做什么。

```ts
interface EmptyStateProps {
  title: string
  description: string
  primaryAction?: ActionSpec
  secondaryAction?: ActionSpec
  reason?: string
}
```

若没有动作，必须提供 `reason` 或等价文案。

## FilterStateSummary

`FilterStateSummary` 说明当前列表是完整结果还是过滤结果。

```ts
interface FilterStateSummaryProps {
  filters: Array<{ label: string; value: string }>
  resultCount: number
  clearAction?: ActionSpec
}
```

示例：

```text
当前显示：状态=待审核，地区=中国大陆，关键词=spam，共 12 条结果
```

有筛选控件的 list/table page 必须有筛选摘要。筛选结果为空时，空状态必须说明筛选条件。

## ContextBar

`ContextBar` 明确当前操作作用到哪个对象。

```ts
interface ContextBarProps {
  subject: string
  meta?: string[]
  status?: StatusSpec
  dirty?: boolean
  autosaveState?: string
}
```

示例：

```text
正在回复：账号误封申诉 · 用户 BinaryUser · 状态：处理中
```

## RecommendationBanner

`RecommendationBanner` 用于评论审核、风控、诊断、巡检等页面，说明系统建议和原因。

```ts
interface RecommendationBannerProps {
  recommendation: string
  confidence?: 'low' | 'medium' | 'high'
  reasons: string[]
  primaryAction?: ActionSpec
  secondaryActions?: ActionSpec[]
  detailsSlot?: unknown
}
```

语义要求：

- 必须说明推荐动作。
- 必须列出原因。
- 必须让用户知道是否能覆盖建议。

## ActionPreviewDialog

`ActionPreviewDialog` 用于批量审核、批量删除、批量恢复、批量迁移等操作执行前的结果预演。

```ts
interface ActionPreviewDialogProps {
  title: string
  affectedCount: number
  effects: string[]
  reversible: boolean
  auditLogged?: boolean
  confirmLabel: string
  cancelLabel?: string
}
```

示例：

```text
将通过 8 条评论，拒绝 2 条评论。该操作会写入审核日志。
```

确认按钮必须使用结果型文案，例如“通过 8 条评论”，不能只写“确定”。
