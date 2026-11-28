import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['index'],
  declaration: true,
  failOnWarn: false,
  clean: false,
  rollup: {
    emitCJS: false,
    output: {
      exports: 'named',
    },
  },
  externals: [
    '@fsusui/core',
    'katex',
    'mermaid',
    'shiki',
    // WASM glue 作为外部资源，由 Vite/打包器处理
    './ep_wasm.mjs',
  ],
})
