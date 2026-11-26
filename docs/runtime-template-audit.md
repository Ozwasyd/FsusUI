# Runtime Template Audit

Generated at: 2026-11-26T10:01:53.489Z

## Summary

- Scanned files: 182
- Total element/component nodes: 1581
- Total findings: 5
- Estimated removable nodes: 5
- Structural review findings: 164
- Estimated reviewable nodes: 164
- Deprecated syntax hits: 0

## Risk Breakdown

- medium: 1
- low: 4

## Finding Categories

- single-child-wrapper: 5

## Structural Wrapper Review

- slot-passthrough-wrapper: 113
- class-only-single-child-wrapper: 36
- component-wrapper-around-component-root: 10
- v-show-sibling-branches: 5

## Deprecated Syntax

- 本轮未发现 `slot-scope`、`template slot=`、`inline-template`、`.native`、`.sync` 命中。

## Highest Yield Files

- `vue/packages/components/markdown-editor/src/markdown-editor.vue`：节点 93，疑似问题 2，预估可减少 2 个节点。L93 single-child-wrapper [low] - 单子节点 span 包裹了 interpolation；L196 single-child-wrapper [low] - 单子节点 span 包裹了 interpolation
- `vue/packages/components/perception-challenge/src/perception-challenge.vue`：节点 24，疑似问题 2，预估可减少 2 个节点。L40 single-child-wrapper [low] - 单子节点 span 包裹了 interpolation；L58 single-child-wrapper [low] - 单子节点 span 包裹了 interpolation
- `vue/packages/components/perception-challenge/src/character-challenge.vue`：节点 25，疑似问题 1，预估可减少 1 个节点。L17 single-child-wrapper [medium] - 单子节点 span 包裹了 interpolation

## Highest Review Yield Files

- `vue/packages/components/inbox-primitives/src/thread-panel.vue`：review 候选 6，预估可审查 6 个节点。L4 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L16 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L20 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L24 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/markdown-editor/src/markdown-editor.vue`：review 候选 6，预估可审查 6 个节点。L94 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 interpolation；L124 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <button>；L188 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 interpolation；L197 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 interpolation
- `vue/packages/components/steps/src/item.vue`：review 候选 6，预估可审查 6 个节点。L16 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <i>；L39 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 interpolation；L55 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 interpolation；L20 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/calendar/src/calendar.vue`：review 候选 5，预估可审查 5 个节点。L5 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 interpolation；L6 component-wrapper-around-component-root [medium] - div 只包裹 <el-button-group component>；L16 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 interpolation；L35 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 interpolation
- `vue/packages/components/metric-primitives/src/status-summary.vue`：review 候选 5，预估可审查 5 个节点。L4 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L7 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L10 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L14 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/page-header/src/page-header.vue`：review 候选 5，预估可审查 5 个节点。L3 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L25 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L30 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L35 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/timeline/src/timeline-item.vue`：review 候选 5，预估可审查 5 个节点。L4 component-wrapper-around-component-root [medium] - div 只包裹 <el-icon component>；L20 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 interpolation；L31 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 interpolation；L15 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/inbox-primitives/src/conversation-list-item.vue`：review 候选 4，预估可审查 4 个节点。L12 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L15 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L20 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L23 slot-passthrough-wrapper [low] - span 只包裹 slot 内容
- `vue/packages/components/input/src/input.vue`：review 候选 4，预估可审查 4 个节点。L18 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 <span>；L52 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 <span>；L12 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L94 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/result/src/result.vue`：review 候选 4，预估可审查 4 个节点。L3 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L12 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L15 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L18 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/select-v2/src/select.vue`：review 候选 4，预估可审查 4 个节点。L62 component-wrapper-around-component-root [medium] - div 只包裹 <el-tag component>；L89 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <div>；L207 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <input>；L256 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 interpolation
- `vue/packages/components/card/src/card.vue`：review 候选 3，预估可审查 3 个节点。L9 slot-passthrough-wrapper [medium] - div 只包裹 slot 内容；L6 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L12 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/collection-primitives/src/collection-toolbar.vue`：review 候选 3，预估可审查 3 个节点。L3 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L9 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L13 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/color-picker/src/color-picker.vue`：review 候选 3，预估可审查 3 个节点。L30 component-wrapper-around-component-root [medium] - span 只包裹 <el-input component>；L76 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 <span>；L77 v-show-sibling-branches [medium] - span 下存在 2 个 v-show sibling branches
- `vue/packages/components/dropdown/src/dropdown-item-impl.vue`：review 候选 3，预估可审查 3 个节点。L33 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L34 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L43 slot-passthrough-wrapper [low] - span 只包裹 slot 内容
- `vue/packages/components/inbox-primitives/src/message-bubble.vue`：review 候选 3，预估可审查 3 个节点。L4 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L7 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L11 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/metric-primitives/src/diagnostics-item.vue`：review 候选 3，预估可审查 3 个节点。L11 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L15 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L27 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/metric-primitives/src/distribution-bar-row.vue`：review 候选 3，预估可审查 3 个节点。L3 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L6 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L9 slot-passthrough-wrapper [low] - span 只包裹 slot 内容
- `vue/packages/components/metric-primitives/src/metric-item.vue`：review 候选 3，预估可审查 3 个节点。L4 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L11 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L18 slot-passthrough-wrapper [low] - span 只包裹 slot 内容
- `vue/packages/components/progress/src/progress.vue`：review 候选 3，预估可审查 3 个节点。L17 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <div>；L67 slot-passthrough-wrapper [medium] - div 只包裹 slot 内容；L31 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/settings-primitives/src/resource-list-item.vue`：review 候选 3，预估可审查 3 个节点。L9 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L13 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L18 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/site-header/src/site-header.vue`：review 候选 3，预估可审查 3 个节点。L10 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L23 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L41 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/statistic/src/statistic.vue`：review 候选 3，预估可审查 3 个节点。L3 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L9 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L15 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/cascader/src/cascader.vue`：review 候选 2，预估可审查 2 个节点。L94 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <div>；L142 v-show-sibling-branches [medium] - template 下存在 2 个 v-show sibling branches
- `vue/packages/components/collection-primitives/src/collection-summary.vue`：review 候选 2，预估可审查 2 个节点。L12 slot-passthrough-wrapper [low] - span 只包裹 slot 内容；L17 slot-passthrough-wrapper [low] - div 只包裹 slot 内容

## Review Notes

- high 风险候选通常带有 ref、事件、ARIA/role、键盘焦点、复杂指令，或承担明显的样式锚点。
- medium 风险候选多为有 class/style 的结构包裹层，适合配合主题样式一起改。
- low 风险候选一般是单子节点纯结构容器，可优先处理。
- Structural Wrapper Review 是人工审查候选，不与 hard findings 混淆；CI 可以只对 hard findings fail，对 review findings warning。
- 完整明细请查看同目录下的 `runtime-template-audit.json`。
