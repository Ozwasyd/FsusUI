# Custom Namespace

FsusUI component classes use the `el` prefix by default, such as `el-button`
and `el-input`. A custom namespace is useful when isolating styles or sharing a
page with another component library.

## Configure the namespace

Update both the runtime provider and the SCSS build configuration. Updating only
one leaves component logic and CSS out of sync.

### 1. Configure `ElConfigProvider`

```vue
<!-- App.vue -->
<template>
  <el-config-provider namespace="ep">
    <!-- 你的应用 -->
  </el-config-provider>
</template>
```

### 2. Configure the SCSS variable

Create `styles/element/index.scss`:

```scss
/* styles/element/index.scss */
@forward '@ozwasyd/element-plus/theme-chalk/src/mixins/config.scss' with (
  $namespace: 'ep'
);
```

Load the variable file from `vite.config.ts`:

```ts
// vite.config.ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        additionalData: `@use "~/styles/element/index.scss" as *;`,
      },
    },
  },
})
```

All component class prefixes then change from `el-` to `ep-`.

## Cautions

- If `append-to` is used, update the `#el-popper-container-` selector prefix as
  well. See [SSR](./ssr.md).
- The namespace is a SCSS **build-time** setting; runtime changes are not
  supported.
