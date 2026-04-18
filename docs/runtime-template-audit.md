# Runtime Template Audit

Generated at: 2026-04-18T04:25:58.367Z

## Summary

- Scanned files: 127
- Total element/component nodes: 971
- Total findings: 0
- Estimated removable nodes: 0
- Deprecated syntax hits: 0

## Risk Breakdown

- none

## Finding Categories

- none

## Deprecated Syntax

- 本轮未发现 `slot-scope`、`template slot=`、`inline-template`、`.native`、`.sync` 命中。

## Highest Yield Files

- none

## Review Notes

- high 风险候选通常带有 ref、事件、ARIA/role、键盘焦点、复杂指令，或承担明显的样式锚点。
- medium 风险候选多为有 class/style 的结构包裹层，适合配合主题样式一起改。
- low 风险候选一般是单子节点纯结构容器，可优先处理。
- 完整明细请查看同目录下的 `runtime-template-audit.json`。
