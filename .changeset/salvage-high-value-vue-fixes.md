---
'element-plus': patch
'@element-plus/components': patch
'@element-plus/theme-chalk': patch
---

Integrate Web/Vue accessibility, theme, runtime, and TypeScript fixes:

- `ElMarkdownRenderer`: validate native Worker `sourceLength` and `normalizedSourceLength` as UTF-8 byte counts so CJK and astral text render without false safe-text fallbacks (`#1067`).
- `ElMarkdownEditor`: synchronize reactive `writingAids` options and allow explicit reset to defaults (`#1026`), use half-open selection/search boundaries in Focus mode (`#1047`), apply Focus dimmed opacity to direct presentation `span.is-dimmed` nodes (`#1051`), and scope prose profile `border-radius` to `chrome="framed"` (`#1076`).
- `ElButton` theme: preserve keyboard `:focus-visible` ring on coarse-pointer hover (`#1011`) and restore enabled danger link button color tokens (`#975`).
- `ElTabs`: forward reactive `aria-label` and `aria-labelledby` to `role="tablist"` (`#1016`) and keep arrow-key navigation inert when the target is not an enabled tab (`#1048`).
- `ElSegmentedControl`: restore primary text contrast for enabled selected options (`#1028`) and keep an enabled Tab stop when the controlled `modelValue` is disabled (`#1040`).
- `ElSelectV2`: restore native `focus()`/`blur()` lifecycle, expose `listbox`/`option`/`aria-controls`/`aria-activedescendant`/`aria-disabled` ARIA semantics, close and reject interactions when inherited form disabled state activates, and clear sticky touch hover state (`#1042`, `#1015`).
- `ElInput`: apply textarea `resize` prop via static CSP-safe CSS classes when `cspSafe` is enabled (`#1012`).
- `ElTableV2`: replace `JSX.IntrinsicAttributes['class']` with Vue's exported `HTMLAttributes['class']` (`#1029`).
