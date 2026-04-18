# Runtime Template Refactor Plan

## Summary

- 审计入口：`pnpm audit:templates`
- 审计范围：`packages/components/**/src/*.vue` 中包含 `<template>` 的运行时 SFC，共 127 个文件
- 当前结论：仓库内没有成规模的废弃模板语法，本轮模板审计与 DOM 减量已完成收口
- 当前审计结果：971 个 element/component 节点，0 个可行动项，预估可继续减少节点数为 0

## Wave 0 Completed

- 已完成一轮低风险 DOM 收缩，优先处理不会改变公开接口的内部结构：
  - `result`：移除 title/subtitle 默认渲染里的额外 `<p>`，节点从 12 降到 10
  - `image-viewer`：压平关闭/翻页/操作区结构，节点从 31 降到 27
  - `input`：移除字数统计的内层壳，节点从 30 降到 29
  - `statistic`：移除 prefix/suffix 默认渲染的额外 `<span>`，节点从 11 降到 9
  - `tag`：移除默认 slot 内容壳
  - `empty`：移除 description 默认渲染的额外 `<p>`
  - `notification`：压平字符串/HTML message 的内容渲染路径
- 同步收口了相关主题样式和测试选择器，未修改任何公开 prop、slot、event 或类型

## Full Pass Completed

- 已继续完成 `cascader`、`select-v2`、`calendar/date-table`、`carousel`、`image`、`progress`、`slider`、`tooltip`、`transfer`、`upload-content` 等剩余项收口
- 对无法安全删除但会被旧审计规则误判的文本样式锚点，已同步收紧审计器判断，确保最终报告只保留真实可行动项
- 当前无需再分新波次推进；后续若新增模板结构，应直接通过 `pnpm audit:templates` 做增量检查

## Guardrails

- 不修改公开 API，只收缩内部 DOM
- 默认不删除承担 `ref`、事件边界、ARIA/role、`tabindex`、复杂指令的容器
- `display: contents` 继续视为例外手段，只在纯布局节点且样式/语义确认安全时使用
- 本轮最终状态已经通过 `pnpm audit:templates`、受影响组件测试、`pnpm typecheck` 和 `pnpm -C packages/demo-app build` 收口
