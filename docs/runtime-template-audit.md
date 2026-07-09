# Runtime Template Audit

Generated at: 2026-06-10T03:14:34.976Z

## Summary

- Scanned files: 132
- Total element/component nodes: 1024
- Total findings: 0
- Estimated removable nodes: 0
- Structural review findings: 90
- Estimated reviewable nodes: 90
- Deprecated syntax hits: 0

## Risk Breakdown

- none

## Finding Categories

- none

## Structural Wrapper Review

- slot-passthrough-wrapper: 53
- class-only-single-child-wrapper: 24
- component-wrapper-around-component-root: 8
- v-show-sibling-branches: 5

## Deprecated Syntax

- 本轮未发现 `slot-scope`、`template slot=`、`inline-template`、`.native`、`.sync` 命中。

## Highest Yield Files

- none

## Highest Review Yield Files

- `vue/packages/components/page-header/src/page-header.vue`：review 候选 5，预估可审查 5 个节点。L3 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L25 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L30 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L35 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/steps/src/item.vue`：review 候选 5，预估可审查 5 个节点。L5 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <i>；L28 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 interpolation；L9 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L36 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/timeline/src/timeline-item.vue`：review 候选 5，预估可审查 5 个节点。L4 component-wrapper-around-component-root [medium] - div 只包裹 <el-icon component>；L20 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 interpolation；L31 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 interpolation；L15 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/input/src/input.vue`：review 候选 4，预估可审查 4 个节点。L20 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 <span>；L55 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 <span>；L14 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L97 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/result/src/result.vue`：review 候选 4，预估可审查 4 个节点。L3 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L12 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L15 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L18 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/select-v2/src/select.vue`：review 候选 4，预估可审查 4 个节点。L62 component-wrapper-around-component-root [medium] - div 只包裹 <el-tag component>；L89 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <div>；L205 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <input>；L252 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 interpolation
- `vue/packages/components/calendar/src/calendar.vue`：review 候选 3，预估可审查 3 个节点。L5 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 interpolation；L6 component-wrapper-around-component-root [medium] - div 只包裹 <el-button-group component>；L3 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/card/src/card.vue`：review 候选 3，预估可审查 3 个节点。L6 slot-passthrough-wrapper [medium] - div 只包裹 slot 内容；L3 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L9 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/color-picker/src/color-picker.vue`：review 候选 3，预估可审查 3 个节点。L30 component-wrapper-around-component-root [medium] - span 只包裹 <el-input component>；L76 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 <span>；L77 v-show-sibling-branches [medium] - span 下存在 2 个 v-show sibling branches
- `vue/packages/components/descriptions/src/description.vue`：review 候选 3，预估可审查 3 个节点。L15 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <table>；L7 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L10 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/progress/src/progress.vue`：review 候选 3，预估可审查 3 个节点。L17 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <div>；L67 slot-passthrough-wrapper [medium] - div 只包裹 slot 内容；L31 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/statistic/src/statistic.vue`：review 候选 3，预估可审查 3 个节点。L3 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L9 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L15 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/cascader/src/cascader.vue`：review 候选 2，预估可审查 2 个节点。L94 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <div>；L142 v-show-sibling-branches [medium] - template 下存在 2 个 v-show sibling branches
- `vue/packages/components/empty/src/empty.vue`：review 候选 2，预估可审查 2 个节点。L9 slot-passthrough-wrapper [medium] - div 只包裹 slot 内容；L12 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/image/src/image.vue`：review 候选 2，预估可审查 2 个节点。L4 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 interpolation；L18 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/responsive-collection/src/responsive-collection.vue`：review 候选 2，预估可审查 2 个节点。L2 v-show-sibling-branches [medium] - div 下存在 2 个 v-show sibling branches；L3 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/select/src/select-dropdown.vue`：review 候选 2，预估可审查 2 个节点。L6 slot-passthrough-wrapper [low] - div 只包裹 slot 内容；L10 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/select/src/select.vue`：review 候选 2，预估可审查 2 个节点。L81 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <div>；L116 component-wrapper-around-component-root [medium] - span 只包裹 <el-tag component>
- `vue/packages/components/tree-v2/src/tree.vue`：review 候选 2，预估可审查 2 个节点。L34 class-only-single-child-wrapper [medium] - div 带 class 且只包裹 <span>；L35 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 interpolation
- `vue/packages/components/tree/src/tree.vue`：review 候选 2，预估可审查 2 个节点。L26 class-only-single-child-wrapper [medium] - span 带 class 且只包裹 interpolation；L24 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/affix/src/affix.vue`：review 候选 1，预估可审查 1 个节点。L3 slot-passthrough-wrapper [medium] - div 只包裹 slot 内容
- `vue/packages/components/alert/src/alert.vue`：review 候选 1，预估可审查 1 个节点。L13 slot-passthrough-wrapper [low] - span 只包裹 slot 内容
- `vue/packages/components/button/src/button-group.vue`：review 候选 1，预估可审查 1 个节点。L2 slot-passthrough-wrapper [low] - div 只包裹 slot 内容
- `vue/packages/components/button/src/button.vue`：review 候选 1，预估可审查 1 个节点。L33 slot-passthrough-wrapper [low] - span 只包裹 slot 内容
- `vue/packages/components/calendar/src/date-table.vue`：review 候选 1，预估可审查 1 个节点。L26 slot-passthrough-wrapper [low] - div 只包裹 slot 内容

## Review Notes

- high 风险候选通常带有 ref、事件、ARIA/role、键盘焦点、复杂指令，或承担明显的样式锚点。
- medium 风险候选多为有 class/style 的结构包裹层，适合配合主题样式一起改。
- low 风险候选一般是单子节点纯结构容器，可优先处理。
- Structural Wrapper Review 是人工审查候选，不与 hard findings 混淆；CI 可以只对 hard findings fail，对 review findings warning。
- 完整明细请查看同目录下的 `runtime-template-audit.json`。
