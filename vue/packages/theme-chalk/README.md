# `@element-plus/theme-chalk`

This workspace package provides FsusUI's Element Plus-compatible theme sources.
The public package is `@ozwasyd/element-plus`; it exposes built CSS and
documented `theme-chalk/*` assets.

Install the public package:

```shell
npm install @ozwasyd/element-plus
```

## Complete theme

`fsus.scss` / `fsus.css` load the compatibility component layer, then FsusUI
tokens and overrides; both light and dark modes are included.

Sass:

```scss
@use '@ozwasyd/element-plus/theme-chalk/src/fsus.scss';
```

Vite or webpack:

```ts
import '@ozwasyd/element-plus/dist/fsus.css'
```

CDN:

```html
<link
  rel="stylesheet"
  href="https://unpkg.com/@ozwasyd/element-plus/dist/fsus.css"
/>
```

## Component CSS

Load individual built styles when an application does not use the complete entry:

```ts
import '@ozwasyd/element-plus/theme-chalk/el-input.css'
import '@ozwasyd/element-plus/theme-chalk/el-select.css'
```

`index.scss` / `index.css` remain compatibility-only base entries. Existing
applications may append `@ozwasyd/element-plus/dist/el-fsus-theme.css` while
migrating, but new applications should load only
`@ozwasyd/element-plus/dist/fsus.css`; combining the complete entry with either
lower-level entry duplicates the base layer.

See [Theme customization](../../../docs/theme/customization.md) for token
overrides and [API stability](../../../docs/api-stability.md) for public
package boundaries.
