# Dark mode

FsusUI 2.0 ships light and dark `--fsus-*` token sets in
`@ozwasyd/fsusui/styles/fsus.css` and follows `prefers-color-scheme` by default.
Use `themeMode` and `syncThemeMode` when your application needs explicit mode
switching, persisted choices, or SSR first-paint consistency.

## Default behavior

```ts
import FsusUI from '@ozwasyd/fsusui'
import '@ozwasyd/fsusui/styles/fsus.css'
```

Activation rules:

- `html.dark` / `[data-fsus-theme='dark']` / `[data-theme-resolved='dark']` — dark tokens;
- `html.light` / `[data-fsus-theme='light']` — light tokens;
- `@media (prefers-color-scheme: dark)` — automatic system mode without JavaScript.

## Recommended setup

### 1. Set `themeMode` when installing

```ts
import { createApp } from 'vue'
import FsusUI from '@ozwasyd/fsusui'
import '@ozwasyd/fsusui/styles/fsus.css'
import App from './App.vue'

createApp(App).use(FsusUI, { themeMode: 'system' }).mount('#app')
```

### 2. Switch dynamically with `FsusConfigProvider`

```vue
<template>
  <FsusConfigProvider :theme-mode="themeMode">
    <App />
  </FsusConfigProvider>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FsusConfigProvider } from '@ozwasyd/fsusui'

const themeMode = ref<'light' | 'dark' | 'system'>('system')
</script>
```

### 3. Synchronize before mount

```ts
import { syncThemeMode } from '@ozwasyd/fsusui/theme'

const storedThemeMode = localStorage.getItem('theme-mode')
syncThemeMode(
  storedThemeMode === 'dark' || storedThemeMode === 'light'
    ? storedThemeMode
    : 'system',
)
```

## Consumer token overrides

Override canonical `--fsus-*` variables in your application stylesheet:

```css
html.dark,
html[data-theme-resolved='dark'] {
  --fsus-color-surface-base: #121214;
  --fsus-color-surface-page: #09090b;
  --fsus-color-text-primary: #f0f0f4;
  --fsus-color-border-subtle: #27272a;
}
```

See [`docs/theme/tokens.md`](../theme/tokens.md) and [`docs/design.md`](../design.md).
