# Dark mode

The public theme entry is `@ozwasyd/element-plus/theme-chalk`; the FsusUI
stylesheet, `@ozwasyd/element-plus/dist/fsus.css`, includes light and dark token
sets and follows `prefers-color-scheme` by default. Importing
the stylesheet is enough for system-following mode. Use `themeMode` and
`syncThemeMode` when the app needs a persisted choice, SSR first-paint
consistency, or an explicit `light`/`dark` mode.

## Default behavior

```ts
import ElementPlus from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/fsus.css'
```

The theme source (`vue/packages/theme-chalk/src/fsus-theme.scss`) defines:

- `html.dark` — force dark mode;
- `html.light` — force light mode by opting out of the dark media rule; and
- `@media (prefers-color-scheme: dark) { html:not(.light) { ... } }` — system
  adaptation.

No application JavaScript is needed for basic system-following behavior.

## Recommended setup

### 1. Set `themeMode` when installing

Use this at the application root:

```ts
import { createApp } from 'vue'
import ElementPlus from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/fsus.css'
import App from './App.vue'

const app = createApp(App)

app.use(ElementPlus, {
  themeMode: 'system',
})

app.mount('#app')
```

`themeMode` accepts:

| Value | Effect |
| --- | --- |
| `system` | Follow the OS preference without forcing `.dark` or `.light`. |
| `dark` | Force dark mode. |
| `light` | Force light mode. |

### 2. Set it on the root `ConfigProvider`

Use this when the app changes modes at runtime:

```vue
<template>
  <el-config-provider :theme-mode="themeMode">
    <App />
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const themeMode = ref<'light' | 'dark' | 'system'>('system')
</script>
```

### 3. Synchronize before mount

Call `syncThemeMode` before Vue starts when a persisted choice must apply to the
first frame:

```ts
import { syncThemeMode } from '@ozwasyd/element-plus/theme'

const storedThemeMode = localStorage.getItem('theme-mode')
syncThemeMode(
  storedThemeMode === 'dark' || storedThemeMode === 'light'
    ? storedThemeMode
    : 'system',
)
```

`syncThemeMode()` updates `<html>` with:

- `class="dark"` or `class="light"` for explicit modes only;
- `data-theme-mode="light|dark|system"`;
- `data-theme-resolved="light|dark"`; and
- `style.colorScheme`.

## Consumer overrides

### CSS variables

In `system` mode, FsusUI resolves dark tokens through the media query rather
than adding `.dark`. Match both explicit and resolved dark roots:

```css
html.dark,
html[data-theme-resolved='dark'] {
  --el-bg-color: #121214;
  --el-bg-color-page: #09090b;
  --el-bg-color-overlay: rgba(18, 18, 20, 0.88);
  --el-text-color-primary: #f0f0f4;
  --el-text-color-secondary: #a1a1aa;
  --el-border-color: #27272a;
  --el-border-color-light: #3f3f46;
}
```

```ts
import '@ozwasyd/element-plus/dist/fsus.css'
import './styles/dark.css'
```

### SCSS variables

For build-time customization, override the dark maps in
`theme-chalk/src/common/var.scss`:

```scss
@forward '@ozwasyd/element-plus/theme-chalk/src/common/var.scss' with (
  $colors-dark: (
    'primary': (
      'base': #4b79cc,
    ),
  ),
  $bg-color-dark: (
    'page': #09090b,
    '': #121214,
    'overlay': #16161a,
  ),
  $text-color-dark: (
    'primary': #f0f0f4,
    'regular': #a1a1aa,
    'secondary': #8b8b95,
  )
);
```

Load this variable file before FsusUI's theme entry in the app's theme build.

## SSR and first paint

For a persisted choice:

1. Render `<html class="dark">` or `<html class="light">` on the server.
2. Call `syncThemeMode(storedThemeMode)` before client mount.
3. Keep the Vue root's `themeMode` in the same state at runtime.

Storage and persistence policy belong to the consuming app; core components do
not persist user data by default.

## Tests and screenshots

Playwright, screenshot scripts, and downstream AGENTS tools should use the
FsusUI helper instead of mutating `document.documentElement.classList`:

```ts
import { installThemeModeTestHelper } from '@ozwasyd/element-plus/theme'

installThemeModeTestHelper({
  persist: true,
  storageKey: 'fsus.ui.themeMode',
})
```

The browser script can then set a mode:

```ts
await page.evaluate(() => {
  window.__fsusUiThemeMode?.set('dark')
})
```

The helper reuses `syncThemeMode`, updates the root class, data attributes, and
`color-scheme`, and optionally writes the requested storage key. For app
runtime persistence or resolved-theme subscriptions, use the stable theme
subpath:

```ts
import {
  readThemeMode,
  subscribeThemeMode,
  syncThemeMode,
  writeThemeMode,
} from '@ozwasyd/element-plus/theme'
```

## Design source

Use [`docs/theme/tokens.md`](../theme/tokens.md) for current token names and
values, and [`docs/design.md`](../design.md) for the visual contract. This
guide does not duplicate palette, radius, shadow, or material values.
