# Theme customization

FsusUI uses the **Intellectual Minimalist** design language. The visual
contract is [`docs/design.md`](../design.md); the public token inventory and
stability levels are [`docs/theme/tokens.md`](../theme/tokens.md). This guide
covers the two consumer override paths: runtime CSS variables and build-time
SCSS variables.

## CSS variable overrides (recommended)

Runtime variables can be changed without recompiling and scoped to a product
shell or feature root. The following values are example app overrides, not a
replacement for the canonical token source:

```css
/* Global app theme. */
:root {
  --el-color-primary: #2a599c;
  --el-bg-color: #fcfcfc;
  --el-bg-color-page: #f7f7f8;
  --el-border-radius-base: 6px;
  --el-border-radius-large: 12px;
}

/* Prefer local scope when only one surface needs the override. */
.my-container {
  --el-color-primary: #2a599c;
  --el-border-radius-base: 6px;
}
```

For dynamic changes:

```ts
const el = document.documentElement
// 读取 CSS 变量
getComputedStyle(el).getPropertyValue('--el-color-primary')
// 修改 CSS 变量
el.style.setProperty('--el-color-primary', '#2A599C')
```

VueUse's [`useCssVar`](https://vueuse.org/core/usecssvar/) is another option.

## SCSS variable overrides

SCSS variables take effect at build time. The source variable file is
`vue/packages/theme-chalk/src/common/var.scss`:

```scss
/* styles/element/index.scss */
@forward '@ozwasyd/element-plus/theme-chalk/src/common/var.scss' with (
  $colors: (
    'primary': (
      'base': #2A599C,  /* FsusUI 学术蓝 */
    ),
  )
);
```

Import the variable file before FsusUI's package entry:

```ts
// main.ts
import { createApp } from 'vue'
import './styles/element/index.scss'  /* 放在 @ozwasyd/element-plus 之前 */
import ElementPlus from '@ozwasyd/element-plus'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
```

When styles are loaded on demand, configure the same file in Vite:

```ts
// vite.config.ts
import path from 'path'
import { defineConfig } from 'vite'
import ElementPlus from 'unplugin-element-plus/vite'

export default defineConfig({
  resolve: {
    alias: { '~/': `${path.resolve(__dirname, 'src')}/` },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        additionalData: `@use "~/styles/element/index.scss" as *;`,
      },
    },
  },
  plugins: [
    ElementPlus({ useSource: true }),
  ],
})
```

Keep the variable file separate from component SCSS so hot updates do not
recompile the component source repeatedly.

## Token and material boundaries

- Add or change public tokens in `spec/tokens/tokens.json`, then run
  `pnpm run tokens:generate`; use [`docs/theme/tokens.md`](../theme/tokens.md)
  for the public names and generated-output rules.
- The canonical radius ladder is `4 / 6 / 10 / 12 / 24 / 999px`; choose the
  role-specific alias rather than minting a local radius.
- Paper material defaults to `0px` backdrop blur and border-first panels. Opt
  into glass only with `.is-glass` or `[data-fsus-material='glass']`; use
  `[data-fsus-surface='reading']` for reading and Markdown surfaces that must
  suppress blur, glow, and trails.
- `--el-color-black` is not emitted by the current theme output; use the
  documented text-role tokens instead of relying on that legacy name.
- `Scholarly Blue` is for links, focus, active, selected, and other functional
  feedback. Do not use it as decoration or introduce gradients/neon colors.
- Prefer public `--el-*` variables or documented `--fsus-*` aliases. Do not
  override component-private selectors or variables to create a variant.

Check focus, hover, active, disabled, and selected states in both light and
dark themes after changing semantic colors.

## Related docs

- [Dark mode](./dark-mode.md)
- [Custom namespace](./namespace.md)
- [Theme token stability](../theme/tokens.md)
- [Design contract](../design.md)
