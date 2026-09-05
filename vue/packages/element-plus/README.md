# `element-plus`

FsusUI's workspace package preserves the Element Plus compatibility surface.
The public npm package is `@ozwasyd/element-plus`; npm preparation maps this
workspace package to that scoped name.

## Install and use

```shell
npm install @ozwasyd/element-plus
```

```ts
import { createApp } from 'vue'
import FsusUI from '@ozwasyd/element-plus'
import '@ozwasyd/element-plus/dist/fsus.css'
import App from './App.vue'

createApp(App).use(FsusUI).mount('#app')
```

The CommonJS root entry remains available:

```js
const elementPlus = require('@ozwasyd/element-plus')
```

Public support follows documented imports. Workspace sources, generated WASM,
build scripts, and fixtures are internal. See [API stability](../../../docs/api-stability.md)
and [Element Plus compatibility](../../../docs/element-plus-compatibility.md).
