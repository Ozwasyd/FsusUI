# Quickstart

This guide shows how to use FsusUI 2.0 (`@ozwasyd/fsusui`) in a Vue 3.5+ project.
See [Installation](./installation.md) for prerequisites and registry setup.

## Full import

```ts
// main.ts
import { createApp } from 'vue'
import FsusUI from '@ozwasyd/fsusui'
import '@ozwasyd/fsusui/styles/fsus.css'
import App from './App.vue'

createApp(App).use(FsusUI).mount('#app')
```

### Volar global types

Add global `Fsus*` component declarations to `compilerOptions.types` in
`tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["@ozwasyd/fsusui/global"]
  }
}
```

## Tree-shakable named imports (recommended)

FsusUI 2.0 is pure ESM with `"sideEffects": ["styles/**/*.css", "dist/styles/**/*.css"]`.
Import only the components and subpaths your page needs:

```vue
<!-- App.vue -->
<template>
  <FsusConfigProvider size="md" theme-mode="system">
    <FsusButton variant="primary" @click="notify">Continue</FsusButton>
  </FsusConfigProvider>
</template>

<script setup lang="ts">
import { FsusButton, FsusConfigProvider, FsusMessage } from '@ozwasyd/fsusui'
import '@ozwasyd/fsusui/styles/fsus.css'

const notify = () => FsusMessage.success('Saved')
</script>
```

## Markdown & WASM (opt-in subpath)

Markdown rendering and editing live on dedicated subpaths so applications that
do not render Markdown pay zero JS and zero CSS overhead:

```ts
import { FsusMarkdownRenderer, FsusMarkdownEditor } from '@ozwasyd/fsusui/markdown'
import '@ozwasyd/fsusui/styles/markdown.css'
```

## Icons & Motion

```ts
import { FsusIcon, FsusIconSearch, registerFsusIcon } from '@ozwasyd/fsusui/icons'
import { FsusMotion, runViewTransition } from '@ozwasyd/fsusui/motion'
```

## Global configuration

```ts
import { createApp } from 'vue'
import FsusUI, { zhCN } from '@ozwasyd/fsusui'
import App from './App.vue'

createApp(App)
  .use(FsusUI, {
    size: 'md',
    zIndex: 2000,
    themeMode: 'system',
    locale: zhCN,
  })
  .mount('#app')
```

`themeMode` accepts `'light' | 'dark' | 'system'`.

## Run the local demo

```bash
pnpm -C vue/packages/demo-app dev
```

## Next steps

- [Migrating from v1 to v2](../migration/v1-to-v2.md)
- [Theme customization](./theming.md)
- [Dark mode](./dark-mode.md)
- [Internationalization](./i18n.md)
- [Component docs](../components/overview.md)
