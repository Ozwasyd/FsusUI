# Migrating From Element Plus

This guide covers the supported public-preview migration path from Element Plus
to FsusUI's current package, `@ozwasyd/element-plus`.

## Install

FsusUI public preview packages are published through GitHub Packages. Configure
the registry as described in
[`docs/guide/installation.md`](../guide/installation.md), then install:

```bash
pnpm install @ozwasyd/element-plus
```

Public npm registry policy, provenance, dist-tags, and promotion rules are
tracked in
[`docs/release/npm-registry-policy.md`](../release/npm-registry-policy.md).

## Replace Runtime Imports

Element Plus:

```ts
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
```

FsusUI:

```ts
import FsusUI from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/index.css'
```

Vue setup:

```ts
import { createApp } from 'vue'
import App from './App.vue'
import FsusUI from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/index.css'

createApp(App).use(FsusUI).mount('#app')
```

## Replace Icon Imports

Element Plus:

```ts
import { Search } from '@element-plus/icons-vue'
```

FsusUI:

```ts
import { Search } from '@ozwasyd/element-plus/icons-vue'
```

## Theme Imports

Use the built CSS entry for application installs:

```ts
import '@ozwasyd/element-plus/dist/index.css'
```

SCSS source imports under `theme-chalk` are preview public only when referenced
by the theme docs. Prefer CSS custom properties for app-level customization.

## ConfigProvider Theme And Motion

FsusUI keeps Element Plus ConfigProvider patterns and adds FsusUI-specific theme
and motion settings.

```vue
<template>
  <el-config-provider :theme-mode="'system'" :motion="{ mode: 'system' }">
    <AppShell />
  </el-config-provider>
</template>
```

Theme token policy is in [`docs/theme/tokens.md`](../theme/tokens.md). Motion
token policy is in [`docs/theme/motion.md`](../theme/motion.md).

## Runtime Target

FsusUI expects modern ES2022 support. If your product still targets older
browsers, transpile FsusUI through your app build or keep the affected surface
on Element Plus until the runtime baseline is updated.

## Migration Checks

Before switching production traffic:

- Replace package and icon imports.
- Replace `element-plus/dist/index.css` with
  `@ozwasyd/element-plus/dist/index.css`.
- Remove direct imports from Element Plus `es/*` or `lib/*` internals unless a
  FsusUI doc page names the equivalent public import.
- Run your application unit tests and smoke tests against the packaged artifact.
- Check any custom theme overrides against
  [`docs/theme/tokens.md`](../theme/tokens.md).
- Check motion-sensitive workflows with `motion.mode` set to `system`,
  `reduced`, and `disabled`.

## Unsupported Shortcuts

Do not migrate by aliasing `element-plus` to `@ozwasyd/element-plus` at the
package manager or bundler level without tests. Deep imports, generated
metadata, and internal build paths are not guaranteed to match Element Plus.
