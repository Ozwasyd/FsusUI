# element-theme-chalk

FsusUI ships a single default component theme through `theme-chalk`.
Importing `index.scss` or `index.css` applies the full FSUS design tokens and component styles by default.
There is no separate dark bundle or alternate theme entry.

## Installation

```shell
npm i element-plus
```

## Usage

Use Sass import

```css
@use 'element-plus/lib/theme-chalk/index.scss';
```

Or Use vite/webpack

```javascript
import 'element-plus/lib/theme-chalk/index.css'
```

Or

```html
<link
  rel="stylesheet"
  href="https://unpkg.com/element-plus/lib/theme-chalk/index.css"
/>
```

## Import on demand

```javascript
import 'element-plus/lib/theme-chalk/input.css'
import 'element-plus/lib/theme-chalk/select.css'

// ...
```

All on-demand component styles share the same default FSUS theme baseline.
