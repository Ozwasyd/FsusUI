# element-theme-chalk

FsusUI ships one complete default production theme through `fsus.scss` / `fsus.css`.
It loads the Element Plus-compatible component layer first and the FsusUI product
tokens and overrides second. Light and dark modes are both included.

## Installation

```shell
npm i element-plus
```

## Usage

Use Sass import

```css
@use 'element-plus/lib/theme-chalk/fsus.scss';
```

Or Use vite/webpack

```javascript
import 'element-plus/lib/theme-chalk/fsus.css'
```

Or

```html
<link
  rel="stylesheet"
  href="https://unpkg.com/element-plus/lib/theme-chalk/fsus.css"
/>
```

## Import on demand

```javascript
import 'element-plus/lib/theme-chalk/input.css'
import 'element-plus/lib/theme-chalk/select.css'

// ...
```

`index.scss` / `index.css` remain compatibility-only base entries. Existing
applications that already load that base may append `fsus-theme.css` while
migrating, but new applications should load only `fsus.css`; combining the
complete entry with either lower-level entry duplicates the base layer.
