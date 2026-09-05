# Task-Oriented Component Semantics

> **Role:** Normative UX semantic contract
> **Applies to:** FsusUI task-oriented compositions and consumer wrappers
> **Authority:** Defines semantic requirements, not a mandated implementation.

This contract covers components, composables, documented patterns, and
consumer-side wrappers that expose these semantics. The consumer must be able
to express them; `pnpm run check:ux-semantics` blocks critical regressions.

## Shared types

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

## `TaskPageHeader`

The header must answer where the user is, what the page does, and what the next
primary action is.

```ts
interface TaskPageHeaderProps {
  title: string
  description?: string
  primaryAction?: ActionSpec
  secondaryActions?: ActionSpec[]
  breadcrumbs?: BreadcrumbItem[]
}
```

Requirements: one primary page heading; `description` states the task scope,
current object, or current state; and `primaryAction` uses a result-oriented
label, not “确定、提交、确认、OK、Submit、Confirm”.

## `TaskActionBar`

The page-level action bar has at most one primary action. Order secondary
actions by risk and frequency, and group dangerous actions separately.

```ts
interface TaskActionBarProps {
  primaryAction?: ActionSpec
  secondaryActions?: ActionSpec[]
  dangerAction?: DangerActionSpec
}
```

`TaskPrimaryAction` represents the next step and must use a result-oriented
label with pending, success, and failure states for asynchronous work.

`TaskSecondaryAction` represents an optional path such as preview, save draft,
copy link, or return to list; it must not outrank the primary action.

## `DangerAction`

Dangerous actions must declare their name, recoverability, notification and
audit behavior, confirmation text, and consequences.

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

- Require either `confirmation` or `undo`.
- State explicitly when a permanent action cannot be recovered.
- Explain whether affected users are notified and whether an audit entry is
  written.
- Describe the affected objects and consequences.

## `EmptyState`

An empty state must explain why it is empty and what the user can do next. If it
has no action, `reason` (or equivalent text) must explain why.

```ts
interface EmptyStateProps {
  title: string
  description: string
  primaryAction?: ActionSpec
  secondaryAction?: ActionSpec
  reason?: string
}
```

## `FilterStateSummary`

The summary distinguishes a complete list from a filtered result.

```ts
interface FilterStateSummaryProps {
  filters: Array<{ label: string; value: string }>
  resultCount: number
  clearAction?: ActionSpec
}
```

```text
当前显示：状态=待审核，地区=中国大陆，关键词=spam，共 12 条结果
```

Every list or table with filters must show the summary and provide a clear
action when a condition can be cleared. An empty filtered result must name its
active conditions.

## `ContextBar`

The context bar identifies the object affected by the current operation.

```ts
interface ContextBarProps {
  subject: string
  meta?: string[]
  status?: StatusSpec
  dirty?: boolean
  autosaveState?: string
}
```

```text
正在回复：账号误封申诉 · 用户 BinaryUser · 状态：处理中
```

## `RecommendationBanner`

Use this banner for moderation, risk, diagnosis, and inspection surfaces.

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

It must state the recommendation, list its reasons, and make clear whether the
user may override it.

## `ActionPreviewDialog`

Use the preview dialog before batch review, delete, restore, or migration.

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

```text
将通过 8 条评论，拒绝 2 条评论。该操作会写入审核日志。
```

The confirmation label must state the result (for example, “通过 8 条评论”),
not only “确定”.
