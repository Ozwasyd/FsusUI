# FsusBlog Consumer Examples

> **Role:** Non-normative consumer example
> **Applies to:** FsusBlog as one FsusUI consumer
> **Authority:** Demonstrates [`docs/consumers/design-integration.md`](../consumers/design-integration.md) and the UX contracts; it does not define FsusUI defaults or FsusBlog route-level design.

These examples show how a content back office can consume FsusUI UX patterns
without binding a business workflow. Runnable Vue snippets live under
`vue/examples/ux-semantics` and are checked by `pnpm run check:ux-semantics`.
FsusBlog owns the composition of its public, reading, and product surfaces;
these examples must not expand FsusUI task-surface defaults.

## Article editor (文章编辑器)

Use `TaskPageHeader` for location and the next action, and `ContextBar` for the
article, author, and save state. Async save and publish actions must expose
pending, success, and failure states.

Reference: `vue/examples/ux-semantics/article-editor.vue`

## Comment moderation (评论审核)

Use `FilterStateSummary` for active filters, `RecommendationBanner` for the
reason to approve or reject, and `DangerAction` for reject, hide, or permanent
delete actions.

Reference: `vue/examples/ux-semantics/comment-moderation.vue`

## Message center (消息中心)

Use `ContextBar` for the reply target and state. When messages are empty,
`EmptyState` explains the reason and offers a return-to-all or clear-filter
action.

Reference: `vue/examples/ux-semantics/message-center.vue`

## Dashboard: today’s work (Dashboard 今日待处理)

Use a task summary for pending work and a recommendation to reduce decision
cost. Long loads show a skeleton or status text rather than a blank region.

Reference: `vue/examples/ux-semantics/dashboard-today.vue`

## Admin navigation groups (管理导航分组)

Use clear group headings and context text for the current management scope.
Before hiding, closing, or deleting a group, state the affected scope,
recoverability, notifications, and audit behavior.

Reference: `vue/examples/ux-semantics/admin-navigation.vue`
